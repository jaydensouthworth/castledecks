package accounts

import (
	_ "embed"
	"encoding/json"
)

// Generated from exact accepted80 JS exports. Regenerate through the fixture
// script when the game adds IDs; never silently downgrade unknown content.
//
//go:embed format_catalog.json
var formatCatalogJSON []byte
var formatCatalog = func() struct {
	Source                                string
	Skills, Companions, Castles, Palettes []string
	DefaultCastle, DefaultPalette         string
} { var v struct {
	Source                                string
	Skills, Companions, Castles, Palettes []string
	DefaultCastle, DefaultPalette         string
}; if err := json.Unmarshal(formatCatalogJSON, &v); err != nil {
	panic("invalid generated format catalog")
}; return v }()
