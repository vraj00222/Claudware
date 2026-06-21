"use client";
import { C, FONT, LAND, LAND_FONT } from "@/design/tokens";

/** Engine badge colors (terracotta-tinted for visual variety within the brand). */
const ENGINE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  openscad: { bg: "#E8F0E8", border: "#B4CEB4", text: "#2D5A2D" },
  blender:  { bg: "#E8E4F0", border: "#C2B8D8", text: "#4A3870" },
  nvidia:   { bg: "#E0F0E8", border: "#A8D8C0", text: "#1A6040" },
  fusion:   { bg: "#F0E8E0", border: "#D8C0A8", text: "#6A4420" },
};

type ShowcaseItem = {
  prompt: string;
  engine: string;
  image: string;
  estimate?: { grams: number; minutes: number; layers: number; material: string };
  meshSizeKB?: number;
  durationSec?: number;
  summary?: string;
  ambitious?: boolean;
};

const SHOWCASE: ShowcaseItem[] = [
  // ───── OpenSCAD (mechanical / parametric) ─────
  { prompt: "a simple phone stand with cable slot", engine: "openscad", image: "/showcase/openscad_a_simple_phone_stand_with_cable_slot.png", estimate: { grams: 50, minutes: 252, layers: 391, material: "PLA" }, meshSizeKB: 1434, durationSec: 70 },
  { prompt: "M10 hex bolt with threads", engine: "openscad", image: "/showcase/openscad_M10_hex_bolt_with_threads.png", estimate: { grams: 3, minutes: 27, layers: 255, material: "PLA" }, meshSizeKB: 1476, durationSec: 90 },
  { prompt: "a gear with 24 teeth and 2mm module", engine: "openscad", image: "/showcase/openscad_a_gear_with_24_teeth_and_2mm_module.png", estimate: { grams: 12, minutes: 59, layers: 80, material: "PLA" }, meshSizeKB: 841, durationSec: 41 },
  // ambitious
  { prompt: "a detailed chess rook piece with crenellations and arched doorway", engine: "openscad", image: "/showcase/openscad_a_detailed_chess_rook_piece_with_crenellations_and_arched_do.png", estimate: { grams: 80, minutes: 399, layers: 435, material: "PLA" }, meshSizeKB: 2508, durationSec: 76, ambitious: true },
  { prompt: "a planetary gear set with sun gear, 3 planet gears, and ring gear", engine: "openscad", image: "/showcase/openscad_a_planetary_gear_set_with_sun_gear_3_planet_gears_and_ring_g.png", estimate: { grams: 60, minutes: 283, layers: 72, material: "PLA" }, meshSizeKB: 2668, durationSec: 402, ambitious: true },
  { prompt: "a gothic cathedral window frame with tracery and rose window pattern", engine: "openscad", image: "/showcase/openscad_a_gothic_cathedral_window_frame_with_tracery_and_rose_window.png", estimate: { grams: 42, minutes: 199, layers: 30, material: "PLA" }, meshSizeKB: 954, durationSec: 327, ambitious: true },

  // ───── NVIDIA (organic figurines via TRELLIS) ─────
  { prompt: "a chubby sitting dragon figurine", engine: "nvidia", image: "/showcase/nvidia_a_chubby_sitting_dragon_figurine.png", estimate: { grams: 20, minutes: 107, layers: 275, material: "PLA" }, meshSizeKB: 5038, durationSec: 291 },
  { prompt: "a cute anime cat figurine", engine: "nvidia", image: "/showcase/nvidia_a_cute_anime_cat_figurine.png", estimate: { grams: 9, minutes: 56, layers: 229, material: "PLA" }, meshSizeKB: 460, durationSec: 274 },
  { prompt: "a small robot toy", engine: "nvidia", image: "/showcase/nvidia_a_small_robot_toy.png", estimate: { grams: 120, minutes: 593, layers: 600, material: "PLA" }, meshSizeKB: 1726, durationSec: 366 },
  // ambitious
  { prompt: "a majestic phoenix bird with spread wings perched on a crystal", engine: "nvidia", image: "/showcase/nvidia_a_majestic_phoenix_bird_with_spread_wings_perched_on_a_cryst.png", estimate: { grams: 188, minutes: 911, layers: 600, material: "PLA" }, meshSizeKB: 1471, durationSec: 138, ambitious: true },
  { prompt: "an ancient Chinese dragon coiled around a treasure chest", engine: "nvidia", image: "/showcase/nvidia_an_ancient_Chinese_dragon_coiled_around_a_treasure_chest.png", estimate: { grams: 13, minutes: 91, layers: 600, material: "PLA" }, meshSizeKB: 5750, durationSec: 130, ambitious: true },
  { prompt: "a steampunk mechanical owl with gears and goggles", engine: "nvidia", image: "/showcase/nvidia_a_steampunk_mechanical_owl_with_gears_and_goggles.png", estimate: { grams: 188, minutes: 911, layers: 600, material: "PLA" }, meshSizeKB: 1471, durationSec: 426, ambitious: true },

  // ───── Blender (organic / procedural bpy) ─────
  { prompt: "a tiny rocket ship", engine: "blender", image: "/showcase/blender_a_tiny_rocket_ship.png", estimate: { grams: 3, minutes: 31, layers: 325, material: "PLA" }, meshSizeKB: 1196, durationSec: 63 },
  { prompt: "a low-poly tree", engine: "blender", image: "/showcase/blender_a_low_poly_tree.png", estimate: { grams: 14, minutes: 83, layers: 355, material: "PLA" }, meshSizeKB: 107, durationSec: 50 },
  { prompt: "a mushroom with spots", engine: "blender", image: "/showcase/blender_a_mushroom_with_spots.png", estimate: { grams: 23, minutes: 121, layers: 236, material: "PLA" }, meshSizeKB: 6823, durationSec: 62 },
  // ambitious
  { prompt: "a detailed pirate ship with sails, cannons, and skull figurehead", engine: "blender", image: "/showcase/blender_a_detailed_pirate_ship_with_sails_cannons_and_skull_figurehe.png", estimate: { grams: 7, minutes: 41, layers: 197, material: "PLA" }, meshSizeKB: 1009, durationSec: 126, ambitious: true },
  { prompt: "an ornate Art Nouveau flower vase with flowing organic curves", engine: "blender", image: "/showcase/blender_an_ornate_Art_Nouveau_flower_vase_with_flowing_organic_curve.png", estimate: { grams: 20, minutes: 112, layers: 350, material: "PLA" }, meshSizeKB: 2817, durationSec: 105, ambitious: true },
  { prompt: "a fantasy wizard tower with spiral staircase and pointed roof", engine: "blender", image: "/showcase/blender_a_fantasy_wizard_tower_with_spiral_staircase_and_pointed_roo.png", estimate: { grams: 47, minutes: 242, layers: 420, material: "PLA" }, meshSizeKB: 94, durationSec: 50, ambitious: true },

  // ───── Fusion 360 (precise parametric CAD) ─────
  { prompt: "a simple L-bracket with two screw holes", engine: "fusion", image: "/showcase/fusion_a_simple_L_bracket_with_two_screw_holes.png", estimate: { grams: 20, minutes: 106, layers: 250, material: "PLA" }, meshSizeKB: 120, durationSec: 40 },
  { prompt: "a round coaster with raised edge", engine: "fusion", image: "/showcase/fusion_a_round_coaster_with_raised_edge.png", estimate: { grams: 25, minutes: 119, layers: 35, material: "PLA" }, meshSizeKB: 2096, durationSec: 102 },
  { prompt: "a small rectangular box with lid", engine: "fusion", image: "/showcase/fusion_a_small_rectangular_box_with_lid.png", estimate: { grams: 29, minutes: 154, layers: 320, material: "PLA" }, meshSizeKB: 392, durationSec: 5 },
  // ambitious
  { prompt: "a Swiss Army knife handle with 3 tool slots and pivot holes", engine: "fusion", image: "/showcase/fusion_a_Swiss_Army_knife_handle_with_3_tool_slots_and_pivot_holes.png", estimate: { grams: 11, minutes: 54, layers: 60, material: "PLA" }, meshSizeKB: 1452, durationSec: 80, ambitious: true },
  { prompt: "a turbine engine blade with cooling channels and mounting flange", engine: "fusion", image: "/showcase/fusion_a_turbine_engine_blade_with_cooling_channels_and_mounting_fl.png", estimate: { grams: 44, minutes: 244, layers: 795, material: "PLA" }, meshSizeKB: 4246, durationSec: 292, ambitious: true },
  { prompt: "a robotic gripper claw with 3 articulated fingers and mounting plate", engine: "fusion", image: "/showcase/fusion_a_robotic_gripper_claw_with_3_articulated_fingers_and_mounti.png", estimate: { grams: 57, minutes: 276, layers: 145, material: "PLA" }, meshSizeKB: 2714, durationSec: 699, ambitious: true },
];

const ENGINE_LABELS: Record<string, string> = {
  openscad: "DIY",
  blender: "Quick Shape",
  nvidia: "Premium 3D",
  fusion: "Pro Mechanical",
};

const ENGINE_DESCRIPTIONS: Record<string, string> = {
  openscad: "Maker-grade parametric parts — gears, bolts, brackets & enclosures you design yourself",
  blender: "Fast procedural models — simpler organic shapes, quick prototypes & artistic forms",
  nvidia: "Premium textured 3D with color — rich figurines, characters & creatures",
  fusion: "Precision CAD for big mechanical parts — assemblies, multi-part prints & engineering components",
};

function EngineBadge({ engine }: { engine: string }) {
  const c = ENGINE_COLORS[engine] || ENGINE_COLORS.openscad;
  return (
    <span style={{
      display: "inline-block", padding: "3px 10px", borderRadius: 6,
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      fontFamily: FONT.mono, fontSize: 11, fontWeight: 600, letterSpacing: "0.02em",
    }}>
      {ENGINE_LABELS[engine] || engine}
    </span>
  );
}

function ShowcaseCard({ item }: { item: ShowcaseItem }) {
  return (
    <div style={{
      borderRadius: 18, overflow: "hidden", background: LAND.cream,
      border: `1px solid ${LAND.border}`,
      transition: "transform 0.2s ease, box-shadow 0.2s ease",
    }}>
      {/* Image area */}
      <div style={{
        position: "relative", width: "100%", aspectRatio: "4/3",
        background: C.viewportBg, overflow: "hidden",
        borderBottom: `1px solid ${LAND.border}`,
      }}>
        {/* Layer-line motif */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          backgroundImage: `repeating-linear-gradient(0deg, ${C.layer}33 0 1px, transparent 1px 8px)`,
          opacity: 0.4, pointerEvents: "none",
        }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={item.prompt}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
        {item.ambitious && (
          <div style={{
            position: "absolute", top: 12, right: 12, zIndex: 2,
            padding: "3px 9px", borderRadius: 6,
            background: C.accent, color: "#fff",
            fontFamily: FONT.mono, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.04em",
          }}>
            AMBITIOUS
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: "16px 18px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <EngineBadge engine={item.engine} />
        </div>

        <p style={{
          fontFamily: LAND_FONT.serif, fontSize: 17, fontWeight: 500,
          lineHeight: "24px", color: LAND.ink, margin: "0 0 10px",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}>
          &ldquo;{item.prompt}&rdquo;
        </p>

        {item.estimate && (
          <div style={{
            display: "flex", gap: 12, flexWrap: "wrap",
            fontFamily: FONT.mono, fontSize: 11, color: LAND.ink3,
          }}>
            <span>{item.estimate.grams}g {item.estimate.material}</span>
            <span>{item.estimate.layers} layers</span>
            {item.meshSizeKB && <span>{item.meshSizeKB > 1000 ? `${(item.meshSizeKB / 1024).toFixed(1)} MB` : `${item.meshSizeKB} KB`}</span>}
            {item.durationSec && <span>{item.durationSec}s</span>}
          </div>
        )}

        {item.ambitious && !item.estimate && (
          <div style={{
            fontFamily: FONT.mono, fontSize: 11, color: LAND.muted,
          }}>
            showcase generation
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShowcasePage() {
  const engines = ["openscad", "nvidia", "blender", "fusion"];

  return (
    <div style={{
      height: "100vh", overflowY: "auto", background: LAND.cream, color: LAND.ink,
      fontFamily: LAND_FONT.sans,
    }}>
      {/* Header */}
      <div style={{
        maxWidth: 1280, margin: "0 auto", padding: "36px 28px 0",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 32 }}>
          <a href="/app" style={{ display: "flex", alignItems: "center", textDecoration: "none" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Claude Hardware" style={{ height: 54, width: "auto", display: "block" }} />
          </a>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/projects" style={{
              display: "flex", alignItems: "center", height: 34, padding: "0 16px",
              borderRadius: 9999, border: `1px solid ${C.border}`, background: C.surface,
              color: C.text, textDecoration: "none", fontFamily: FONT.sans, fontSize: 13, fontWeight: 600,
            }}>
              Projects
            </a>
            <a href="/app" style={{
              display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 16px",
              borderRadius: 9999, background: C.accent, color: "#fff",
              textDecoration: "none", fontFamily: FONT.sans, fontSize: 13, fontWeight: 700,
            }}>
              <span style={{ fontSize: 15, marginTop: -1 }}>+</span> New project
            </a>
          </div>
        </div>

        {/* Hero */}
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h1 style={{
            fontFamily: LAND_FONT.serif, fontSize: 42, fontWeight: 600,
            letterSpacing: "-0.03em", lineHeight: "48px", margin: "0 0 12px",
            color: LAND.ink,
          }}>
            Engine Showcase
          </h1>
          <p style={{
            fontFamily: LAND_FONT.sans, fontSize: 17, color: LAND.ink2,
            maxWidth: 600, margin: "0 auto 8px", lineHeight: "26px",
          }}>
            Every model below was generated from a single text prompt — no hand-editing, no post-processing. Four engines, one brain.
          </p>
          <p style={{
            fontFamily: FONT.mono, fontSize: 12, color: LAND.muted,
          }}>
            {SHOWCASE.length} models across {engines.length} engines
          </p>
        </div>
      </div>

      {/* Engine sections */}
      {engines.map((engine) => {
        const items = SHOWCASE.filter((s) => s.engine === engine);
        if (!items.length) return null;
        const col = ENGINE_COLORS[engine] || ENGINE_COLORS.openscad;
        return (
          <section key={engine} style={{ maxWidth: 1280, margin: "0 auto", padding: "0 28px 56px" }}>
            {/* Engine header */}
            <div style={{
              display: "flex", alignItems: "baseline", gap: 14, marginBottom: 8,
              borderBottom: `2px solid ${col.border}`, paddingBottom: 10,
            }}>
              <h2 style={{
                fontFamily: LAND_FONT.serif, fontSize: 28, fontWeight: 600,
                letterSpacing: "-0.02em", margin: 0, color: col.text,
              }}>
                {ENGINE_LABELS[engine]}
              </h2>
              <span style={{
                fontFamily: FONT.mono, fontSize: 12, color: LAND.muted,
              }}>
                {items.length} models
              </span>
            </div>
            <p style={{
              fontFamily: FONT.mono, fontSize: 12.5, color: LAND.ink3,
              margin: "0 0 20px",
            }}>
              {ENGINE_DESCRIPTIONS[engine]}
            </p>

            {/* Cards grid */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: 20,
            }}>
              {items.map((item, i) => (
                <ShowcaseCard key={i} item={item} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Footer */}
      <div style={{
        textAlign: "center", padding: "40px 28px 48px",
        fontFamily: FONT.mono, fontSize: 12, color: LAND.muted,
        borderTop: `1px solid ${LAND.border}`, maxWidth: 1280, margin: "0 auto",
      }}>
        Built with Claude Code at CAL AI HACKATHON 2026 — describe it, we make it printable.
      </div>
    </div>
  );
}
