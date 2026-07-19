// Project-owned ESLint overrides (ADR-CORE-032). Never pinned, never overwritten by
// `governance:update`; appended AFTER the core config (eslint.config.mjs), so entries here only ADD to
// or narrowly override what the core enforces — never weaken it silently (rule:code-quality).
export default [
  {
    files: ["src/components/VideoPlayer.tsx"],
    rules: {
      // jsx-a11y/media-has-caption assumes public media with an available caption track. This <video>
      // previews the user's own local file (ADR-PROJ-001 §5): the backend has no subtitle-extraction
      // pipeline — `probe_media` reports subtitle stream *metadata* (codec/language) only, never a
      // WebVTT file a <track> could point at — and the player exposes no native `controls`, so no
      // captions toggle could ever surface one either way. A `<track kind="captions">` with no real
      // cues would satisfy the linter while asserting a caption track to assistive tech that does not
      // exist — worse than the warning it silences. Revisit if the backend ever gains subtitle-to-WebVTT
      // extraction (rule:code-quality: "a warning you cannot fix is discussed, not silenced" — this is
      // that discussion, recorded).
      "jsx-a11y/media-has-caption": "off",
    },
  },
];
