package accounts

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
	"regexp"
)

const MaxDocument = 2*1024*1024 + 8192

// Scan duplicate keys/depth before decoding: encoding/json otherwise permits
// last-key-wins ambiguity. Structural acceptance is not proof of earned progress.
func strictJSON(raw []byte) error {
	d := json.NewDecoder(bytes.NewReader(raw))
	d.UseNumber()
	var scan func(int) error
	scan = func(depth int) error {
		if depth > 40 {
			return errors.New("too deep")
		}
		token, err := d.Token()
		if err != nil {
			return err
		}
		if delimiter, ok := token.(json.Delim); ok {
			switch delimiter {
			case '{':
				keys := map[string]bool{}
				for d.More() {
					key, err := d.Token()
					if err != nil {
						return err
					}
					name, ok := key.(string)
					if !ok || keys[name] {
						return errors.New("duplicate key")
					}
					keys[name] = true
					if err = scan(depth + 1); err != nil {
						return err
					}
				}
				end, err := d.Token()
				if err != nil || end != json.Delim('}') {
					return errors.New("invalid object")
				}
			case '[':
				for d.More() {
					if err := scan(depth + 1); err != nil {
						return err
					}
				}
				end, err := d.Token()
				if err != nil || end != json.Delim(']') {
					return errors.New("invalid array")
				}
			default:
				return errors.New("unexpected delimiter")
			}
		}
		return nil
	}
	if err := scan(0); err != nil {
		return err
	}
	if _, err := d.Token(); err != io.EOF {
		return errors.New("trailing JSON")
	}
	return nil
}
func object(raw []byte, keys ...string) (map[string]json.RawMessage, error) {
	if err := strictJSON(raw); err != nil {
		return nil, err
	}
	var v map[string]json.RawMessage
	if json.Unmarshal(raw, &v) != nil || v == nil || len(v) != len(keys) {
		return nil, errors.New("invalid object")
	}
	for _, key := range keys {
		if _, ok := v[key]; !ok {
			return nil, errors.New("unknown or missing key")
		}
	}
	return v, nil
}
func str(raw json.RawMessage) string { var s string; _ = json.Unmarshal(raw, &s); return s }
func ValidateDocument(kind, text string) error {
	limit := MaxDocument
	if kind == "decks" {
		limit = 32768
	}
	if kind == "wayfarer" {
		limit = 1024 * 1024
	}
	if len(text) == 0 || len(text) > limit {
		return errors.New("document size")
	}
	raw := []byte(text)
	if err := strictJSON(raw); err != nil {
		return err
	}
	var v map[string]json.RawMessage
	if json.Unmarshal(raw, &v) != nil || v == nil {
		return errors.New("document object required")
	}
	switch kind {
	case "decks":
		schema := str(v["schema"])
		if schema != "castledecks-deck-presets-1" && schema != "castledecks-deck-presets-2" {
			return errors.New("unsupported deck schema")
		}
		if _, err := object(raw, "schema", "decks"); err != nil {
			return err
		}
		if err := validateDeckLibrary(v["decks"], schema == "castledecks-deck-presets-1"); err != nil {
			return err
		}
	case "crownroad":
		schema := str(v["schema"])
		if schema != "castledecks-local-checkpoint-1" && schema != "castledecks-local-checkpoint-2" && schema != "castledecks-local-checkpoint-3" {
			return errors.New("unsupported checkpoint schema")
		}
		if _, err := object(raw, "schema", "revision", "writtenAt", "transaction", "reason", "payload"); err != nil {
			return err
		}
		if !integer(v["revision"], 1, 9007199254740991) || !integer(v["writtenAt"], 0, 8640000000000000) || !regexp.MustCompile(`^[A-Za-z0-9_-]{1,80}$`).MatchString(str(v["transaction"])) {
			return errors.New("invalid checkpoint metadata")
		}
		reasons := map[string]bool{"ready": true, "battle-start": true, "result": true, "purchase": true, "loadout": true, "settings": true, "profiles": true, "import": true}
		if !reasons[str(v["reason"])] {
			return errors.New("invalid checkpoint reason")
		}
		keys := []string{"bundle", "activeIndex", "resume"}
		var envelopePayload map[string]json.RawMessage
		_ = json.Unmarshal(v["payload"], &envelopePayload)
		_, hasDecks := envelopePayload["deckPresets"]
		if schema == "castledecks-local-checkpoint-2" || schema == "castledecks-local-checkpoint-3" && hasDecks {
			keys = append(keys, "deckPresets")
		}
		payload, err := object(v["payload"], keys...)
		if err != nil {
			return err
		}
		bundle := str(payload["bundle"])
		if len(bundle) > 1024*1024 || bundle == "" {
			return errors.New("invalid bundle")
		}
		bundleValue, err := bundleProfiles([]byte(bundle))
		if err != nil {
			return err
		}
		var bundleEnvelope map[string]json.RawMessage
		_ = json.Unmarshal([]byte(bundle), &bundleEnvelope)
		if schema != "castledecks-local-checkpoint-3" && str(bundleEnvelope["schema"]) != "bowmaster-reconstruction-profiles-1" {
			return errors.New("profile requires newer checkpoint")
		}
		active := bundleValue["profiles"]
		if !integer(payload["activeIndex"], 0, int64(len(active)-1)) {
			return errors.New("invalid active profile")
		}
		if hasDecks {
			decks, err := object(payload["deckPresets"], "schema", "profiles", "retired")
			if err != nil {
				return err
			}
			deckSchema := str(decks["schema"])
			if deckSchema != "castledecks-profile-decks-1" && deckSchema != "castledecks-profile-decks-2" {
				return errors.New("invalid profile deck schema")
			}
			if schema != "castledecks-local-checkpoint-3" && deckSchema != "castledecks-profile-decks-1" {
				return errors.New("decks require newer checkpoint")
			}
			for _, key := range []string{"profiles", "retired"} {
				var list []json.RawMessage
				if json.Unmarshal(decks[key], &list) != nil || list == nil || len(list) != len(bundleValue[key]) {
					return errors.New("profile deck alignment")
				}
				for _, library := range list {
					if err := validateDeckLibrary(library, deckSchema == "castledecks-profile-decks-1"); err != nil {
						return err
					}
				}
			}
		}
		resume, err := object(payload["resume"], "phase", "level", "outcome")
		if err != nil {
			return err
		}
		if !integer(resume["level"], 1, 30) {
			return errors.New("invalid checkpoint level")
		}
		var index float64
		_ = json.Unmarshal(payload["activeIndex"], &index)
		var record, profile map[string]json.RawMessage
		_ = json.Unmarshal(active[int(index)], &record)
		_ = json.Unmarshal(record["profile"], &profile)
		var frontier float64
		_ = json.Unmarshal(profile["highestLevel"], &frontier)
		if frontier > 30 {
			frontier = 30
		}
		var resumeLevel float64
		_ = json.Unmarshal(resume["level"], &resumeLevel)
		if resumeLevel != frontier {
			return errors.New("checkpoint frontier mismatch")
		}

		phase := str(resume["phase"])
		if phase != "ready" && phase != "opening" && phase != "result" {
			return errors.New("unsafe checkpoint phase")
		}
		outcome := str(resume["outcome"])
		if phase == "result" {
			if outcome != "victory" && outcome != "defeat" {
				return errors.New("invalid result")
			}
		} else if string(resume["outcome"]) != "null" {
			return errors.New("invalid unsettled result")
		}
	case "wayfarer":
		if (str(v["schema"]) != "castledecks-expeditions-1" && str(v["schema"]) != "castledecks-expeditions-2") || str(v["campaign"]) != "wayfarer-charter" {
			return errors.New("unsupported expedition")
		}
		if _, err := object(raw, "schema", "campaign", "profiles", "runs", "retiredRuns"); err != nil {
			return err
		}
		var profileEnvelope map[string]json.RawMessage
		_ = json.Unmarshal(v["profiles"], &profileEnvelope)
		if str(v["schema"]) == "castledecks-expeditions-1" && str(profileEnvelope["schema"]) != "bowmaster-reconstruction-profiles-1" {
			return errors.New("profile requires newer charter")
		}
		bundle, err := bundleProfiles(v["profiles"])
		if err != nil {
			return err
		}
		for _, key := range []string{"runs", "retiredRuns"} {
			var runs []json.RawMessage
			if json.Unmarshal(v[key], &runs) != nil || runs == nil {
				return errors.New("invalid runs")
			}
			profileKey := "profiles"
			if key == "retiredRuns" {
				profileKey = "retired"
			}
			profiles := bundle[profileKey]
			if len(runs) != len(profiles) {
				return errors.New("expedition profile alignment")
			}
			for _, run := range runs {
				if _, err := object(run, "seed", "path", "cleared", "lastResult"); err != nil {
					return err
				}
			}

		}
	default:
		return errors.New("unknown kind")
	}
	return nil
}

// Validation never rewrites documents. Only the game codecs perform explicit
// legacy migration; stored old exports remain byte-for-byte recoverable.
func validateBundle(raw []byte) error { _, err := bundleProfiles(raw); return err }
func bundleProfiles(raw []byte) (map[string][]json.RawMessage, error) {
	if len(raw) > 1024*1024 {
		return nil, errors.New("profile bundle size")
	}
	var header map[string]json.RawMessage
	if json.Unmarshal(raw, &header) != nil {
		return nil, errors.New("invalid profile bundle")
	}
	schema := str(header["schema"])
	result := map[string][]json.RawMessage{"profiles": {}, "retired": {}}
	if schema == "bowmaster-reconstruction-1" || schema == "bowmaster-reconstruction-2" || schema == "bowmaster-reconstruction-3" {
		if err := validateProfile(raw); err != nil {
			return nil, err
		}
		record, _ := json.Marshal(map[string]any{"profile": json.RawMessage(raw), "cheated": false})
		result["profiles"] = []json.RawMessage{record}
		return result, nil
	}
	v, err := object(raw, "schema", "profiles", "retired")
	if err != nil {
		return nil, err
	}
	if schema != "bowmaster-reconstruction-profiles-1" && schema != "bowmaster-reconstruction-profiles-2" {
		return nil, errors.New("unsupported profile bundle")
	}
	for _, key := range []string{"profiles", "retired"} {
		var list []json.RawMessage
		if json.Unmarshal(v[key], &list) != nil || list == nil || key == "profiles" && (len(list) < 1 || len(list) > 9) {
			return nil, errors.New("invalid profile count")
		}
		for _, raw := range list {
			record, err := object(raw, "profile", "cheated")
			if err != nil {
				return nil, err
			}
			if string(record["cheated"]) != "true" && string(record["cheated"]) != "false" {
				return nil, errors.New("invalid provenance")
			}
			var p map[string]json.RawMessage
			_ = json.Unmarshal(record["profile"], &p)
			if schema == "bowmaster-reconstruction-profiles-1" && str(p["schema"]) == "bowmaster-reconstruction-3" {
				return nil, errors.New("profile requires newer bundle")
			}
			if err := validateProfile(record["profile"]); err != nil {
				return nil, err
			}
		}
		result[key] = list
	}
	return result, nil
}

func integer(raw json.RawMessage, min, max int64) bool {
	return number(raw, float64(min), float64(max), true)
}
