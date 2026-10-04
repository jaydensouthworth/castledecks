package accounts

import (
	"encoding/json"
	"errors"
	"math"
	"strconv"
)

func known(id string, values []string) bool {
	for _, value := range values {
		if id == value {
			return true
		}
	}
	return false
}
func number(raw json.RawMessage, min, max float64, integral bool) bool {
	value, err := strconv.ParseFloat(string(raw), 64)
	return err == nil && !math.IsNaN(value) && !math.IsInf(value, 0) && value >= min && value <= max && (!integral || value == math.Trunc(value))
}
func validateCastle(raw json.RawMessage) (string, error) {
	v, err := object(raw, "id", "level")
	if err != nil {
		return "", err
	}
	id := str(v["id"])
	if !known(id, formatCatalog.Castles) || !integer(v["level"], 1, 1) {
		return "", errors.New("unsupported castle or level")
	}
	return id, nil
}
func validateCastles(raw json.RawMessage) error {
	v, err := object(raw, "owned", "selected")
	if err != nil {
		return err
	}
	var records []json.RawMessage
	if json.Unmarshal(v["owned"], &records) != nil || len(records) < 1 || len(records) > 64 {
		return errors.New("invalid castle collection")
	}
	seen := map[string]bool{}
	for _, record := range records {
		id, err := validateCastle(record)
		if err != nil {
			return err
		}
		if seen[id] {
			return errors.New("duplicate castle")
		}
		seen[id] = true
	}
	if !seen[formatCatalog.DefaultCastle] || !seen[str(v["selected"])] {
		return errors.New("unowned selected castle")
	}
	return nil
}
func validateDeckLibrary(raw json.RawMessage, legacy bool) error {
	var decks []json.RawMessage
	if json.Unmarshal(raw, &decks) != nil || decks == nil || len(decks) > 12 {
		return errors.New("invalid decks")
	}
	for _, deck := range decks {
		keys := []string{"name", "slots", "companion"}
		if !legacy {
			keys = append(keys, "castle")
		}
		d, err := object(deck, keys...)
		if err != nil {
			return err
		}
		if name := str(d["name"]); len(name) == 0 || len(name) > 160 {
			return errors.New("invalid deck name")
		}
		if !legacy {
			if _, err := validateCastle(d["castle"]); err != nil {
				return err
			}
		}
		var slots []json.RawMessage
		if json.Unmarshal(d["slots"], &slots) != nil || len(slots) != 30 {
			return errors.New("invalid deck slots")
		}
		seen := map[string]bool{}
		for _, slot := range slots {
			if string(slot) == "null" {
				continue
			}
			id := str(slot)
			if !known(id, formatCatalog.Skills) || seen[id] {
				return errors.New("unknown or duplicate deck skill")
			}
			seen[id] = true
		}
		if string(d["companion"]) != "null" && !known(str(d["companion"]), formatCatalog.Companions) {
			return errors.New("unsupported companion")
		}
	}
	return nil
}
func validateProfile(raw json.RawMessage) error {
	if len(raw) > 64*1024 {
		return errors.New("profile size")
	}
	var header map[string]json.RawMessage
	if json.Unmarshal(raw, &header) != nil {
		return errors.New("invalid profile")
	}
	schema := str(header["schema"])
	if schema != "bowmaster-reconstruction-1" && schema != "bowmaster-reconstruction-2" && schema != "bowmaster-reconstruction-3" {
		return errors.New("unsupported profile")
	}
	keys := []string{"schema", "name", "rank", "xp", "gold", "scene", "level", "highestScene", "highestLevel", "victories", "defeats", "difficulty", "shootingMode", "skills"}
	if schema != "bowmaster-reconstruction-1" {
		keys = append(keys, "companions")
	}
	if schema == "bowmaster-reconstruction-3" {
		keys = append(keys, "castles", "appearance")
	}
	v, err := object(raw, keys...)
	if err != nil {
		return err
	}
	if schema == "bowmaster-reconstruction-3" {
		if err := validateCastles(v["castles"]); err != nil {
			return err
		}
		appearance, err := object(v["appearance"], "palette")
		if err != nil {
			return err
		}
		if !known(str(appearance["palette"]), formatCatalog.Palettes) {
			return errors.New("unsupported player palette")
		}
	}
	// Old schemas intentionally have no castle/appearance fields. The JS reader
	// adds Classic level1 and Azure only during an explicit successful migration.
	if schema != "bowmaster-reconstruction-1" {
		companion, err := object(v["companions"], "owned", "selected")
		if err != nil {
			return err
		}
		var owned []string
		if json.Unmarshal(companion["owned"], &owned) != nil || owned == nil || len(owned) > len(formatCatalog.Companions) {
			return errors.New("invalid companion roster")
		}
		seen := map[string]bool{}
		for _, id := range owned {
			if !known(id, formatCatalog.Companions) || seen[id] {
				return errors.New("unknown or duplicate companion")
			}
			seen[id] = true
		}
		if string(companion["selected"]) != "null" && !seen[str(companion["selected"])] {
			return errors.New("unowned companion")
		}
	}
	var name string
	if string(v["name"]) == "null" || json.Unmarshal(v["name"], &name) != nil || !known(str(v["difficulty"]), []string{"easy", "medium", "hard", "insane"}) || !known(str(v["shootingMode"]), []string{"classic", "anywhere", "point_aim", "auto_aim"}) {
		return errors.New("invalid profile scalar")
	}
	const maximum = 9007199254740991
	if !integer(v["rank"], 1, 26) || !integer(v["xp"], -maximum, maximum) {
		return errors.New("invalid profile rank or XP")
	}
	for _, key := range []string{"gold", "victories", "defeats"} {
		if !integer(v[key], 0, maximum) {
			return errors.New("invalid profile counter")
		}
	}
	for _, key := range []string{"level", "highestLevel"} {
		if !integer(v[key], 1, 31) {
			return errors.New("invalid profile level")
		}
	}
	for _, key := range []string{"scene", "highestScene"} {
		if !integer(v[key], 1, 33) {
			return errors.New("invalid profile scene")
		}
	}
	var skills []json.RawMessage
	if json.Unmarshal(v["skills"], &skills) != nil || len(skills) < 1 || len(skills) > len(formatCatalog.Skills) {
		return errors.New("invalid skills")
	}
	seen := map[string]bool{}
	for _, raw := range skills {
		skill, err := object(raw, "id", "rank", "xp", "threshold", "passive", "binding", "autocast")
		if err != nil {
			return err
		}
		id := str(skill["id"])
		if !known(id, formatCatalog.Skills) || seen[id] {
			return errors.New("unknown or duplicate skill")
		}
		seen[id] = true
		if !integer(skill["rank"], 0, 10) || !number(skill["xp"], -maximum, maximum, false) || !integer(skill["binding"], -1, 29) || !integer(skill["threshold"], 100, 1100) {
			return errors.New("invalid skill values")
		}
		var rank, threshold float64
		_ = json.Unmarshal(skill["rank"], &rank)
		_ = json.Unmarshal(skill["threshold"], &threshold)
		if threshold != (rank+1)*100 {
			return errors.New("invalid skill threshold")
		}
		for _, key := range []string{"passive", "autocast"} {
			if string(skill[key]) != "true" && string(skill[key]) != "false" {
				return errors.New("invalid skill flag")
			}
		}
	}
	if !seen["arrow"] {
		return errors.New("missing basic arrow")
	}
	return nil
}
