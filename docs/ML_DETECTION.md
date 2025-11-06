# ML-Based PII Detection

## Model Selection

### Chosen Model: `Xenova/bert-base-NER`

**Specifications:**
- Size: ~110MB (ONNX format, quantized)
- Entity Types: PER (Person), ORG (Organization), LOC (Location), MISC (Miscellaneous)
- Accuracy: F1 score ~92% on CoNLL-2003 benchmark
- Inference Speed: ~100-200ms per page of text (browser, WebGL backend)

**Why This Model:**
1. Officially supported by @xenova/transformers
2. Pre-quantized for browser use (smaller size)
3. Well-tested and documented
4. Good balance between size and accuracy
5. Detects person names with high accuracy (key for PII)

**Entity Mapping to PII Types:**
- `B-PER`, `I-PER` → Person Names
- Will supplement existing regex for emails, phones, SSNs, credit cards
- ML excels at context-aware detection (e.g., "John Doe" without patterns)

### Alternative Models Considered

1. **`Xenova/distilbert-base-NER`**
   - Smaller (68MB) but slightly lower accuracy
   - Faster inference but only 2% performance gain
   - Decision: Size savings not worth accuracy trade-off

2. **`dslim/bert-base-NER`**
   - Similar accuracy to Xenova/bert-base-NER
   - Not officially optimized for Xenova library
   - Decision: Use official Xenova model for better support

3. **Custom PII-specific models**
   - Could fine-tune on PII-specific datasets
   - Requires significant ML expertise and training time
   - Decision: Defer to future enhancement

## Architecture

### Detection Pipeline

```
PDF/Image → Text Extraction
     ↓
     ├─→ Regex Detection (patterns.ts) ─────┐
     │                                       ↓
     └─→ ML Detection (ml.ts) ──────────→ Merge Results
                                             ↓
                                      Deduplicate Overlaps
                                             ↓
                                      Find Bounding Boxes
                                             ↓
                                      Display on Canvas
```

### Detection Merging Strategy

When both regex and ML detect the same entity:
1. **Prefer ML result** if confidence > 0.85
2. **Expand to include both** if partially overlapping
3. **Keep both** if detecting different types (e.g., ML found name, regex found email)

### Caching Strategy

- **Model Cache:** IndexedDB (persistent across sessions)
- **Detection Cache:** Memory (current session only, per document hash)
- **Cache Invalidation:** When user changes file or detection settings

## Performance Targets

- **First load:** Model download <30s on 10Mbps connection
- **Subsequent loads:** <2s (cached)
- **Inference:** <500ms per page
- **Memory usage:** <400MB total (model + inference)

## Browser Compatibility

**Minimum Requirements:**
- Chrome/Edge 90+
- Firefox 89+
- Safari 15.4+
- WebGL 2.0 support (for GPU acceleration)

**Fallback:**
- If WebGL unavailable, gracefully disable ML detection
- Always fallback to regex-only mode

## Privacy Guarantee

- Model runs 100% in browser (WASM + WebGL)
- No data sent to external servers
- No telemetry or analytics
- Model cached locally (IndexedDB)
- Can work completely offline after first download
