package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"github.com/jaydensouthworth/castledecks/backend/internal/accounts"
	"io"
	"os"
	"time"
)

func readJSON(path string, v any) error {
	f, e := os.Open(path)
	if e != nil {
		return e
	}
	defer f.Close()
	d := json.NewDecoder(io.LimitReader(f, 16385))
	d.DisallowUnknownFields()
	if e = d.Decode(v); e != nil {
		return e
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		return errors.New("extra input")
	}
	return nil
}
func run() error {
	command := flag.String("command", "", "init, anchor, backup, restore, prepare or prune")
	jp := flag.String("journal", "", "independent journal path")
	pp := flag.String("policy", "", "explicit policy JSON path")
	dbp := flag.String("db", "", "live database path for backup/prune")
	input := flag.String("input", "", "backup/candidate path")
	output := flag.String("output", "", "NEW output path")
	metadata := flag.String("metadata", "", "input metadata JSON")
	anchorFile := flag.String("expected-anchor", "", "independently retained current anchor JSON")
	stopped := flag.Bool("service-stopped", false, "operator confirms live service stopped")
	flag.Parse()
	if *command == "" || *jp == "" || *pp == "" {
		return errors.New("explicit command, journal and policy required")
	}
	policy, e := accounts.LoadRecoveryPolicy(*pp)
	if e != nil {
		return e
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	var j *accounts.DeletionJournal
	if *command == "init" {
		j, e = accounts.InitializeDeletionJournal(*jp, policy)
	} else {
		j, e = accounts.OpenDeletionJournal(*jp, policy)
	}
	if e != nil {
		return e
	}
	defer j.Close()
	var result any
	switch *command {
	case "init", "anchor":
		result, e = j.Anchor(ctx)
	case "backup", "prune":
		if !*stopped || *dbp == "" {
			return errors.New("stopped service and explicit database required")
		}
		s, openErr := accounts.OpenRecoverySource(*dbp)
		if openErr != nil {
			return openErr
		}
		defer s.Close()
		if e = s.ConfigureDeletionJournal(ctx, j); e != nil {
			return e
		}
		if *command == "backup" {
			if *output == "" {
				return errors.New("new output required")
			}
			result, e = s.CreateRecoveryBackup(ctx, *output, time.Now())
		} else {
			var a accounts.JournalAnchor
			if e = readJSON(*anchorFile, &a); e != nil {
				return e
			}
			result, e = s.PruneDeletionJournal(ctx, time.Now(), a)
		}
	case "restore", "prepare":
		if !*stopped || *input == "" || *output == "" || *metadata == "" || *anchorFile == "" {
			return errors.New("stopped service, input, new output, metadata and current anchor required")
		}
		var m accounts.RecoveryBackup
		var a accounts.JournalAnchor
		if e = readJSON(*metadata, &m); e != nil {
			return e
		}
		if e = readJSON(*anchorFile, &a); e != nil {
			return e
		}
		if *command == "restore" {
			result, e = j.RestoreQuarantine(ctx, *input, *output, m, a, time.Now())
		} else {
			result, e = j.PrepareRecoveryActivation(ctx, *input, *output, m, a, time.Now())
		}
	default:
		return errors.New("unknown command")
	}
	if e != nil {
		return e
	}
	return json.NewEncoder(os.Stdout).Encode(result)
}
func main() {
	if e := run(); e != nil {
		fmt.Fprintln(os.Stderr, "recovery operation failed; no live replacement performed; inspect configuration and private storage")
		os.Exit(1)
	}
}
