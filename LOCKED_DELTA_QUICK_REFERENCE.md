# LOCKED/DELTA Quick Reference Guide

## The Problem We're Solving

When generating images with reference images, the AI was re-describing entire scenes instead of just specifying what changed. This caused:
- The model to ignore reference images
- Visual drift and inconsistency
- Unrealistic outputs (giant objects, disembodied heads)
- Model failures and errors

## The Solution: LOCKED/DELTA Pattern

### Core Principle
**Trust the reference images.** They already contain identity, environment, lighting, and style. Your prompt should only specify what stays the same (LOCKED) and what changes (DELTA).

---

## Format

```
LOCKED: [brief list of what stays the same - MAX 20 words]
DELTA: [brief description of what changes - MAX 40 words]
```

**Total word count**: 60-80 words maximum

---

## LOCKED Components
What the reference images already contain (do NOT re-describe):

✓ Avatar identity and appearance  
✓ Wardrobe and styling  
✓ Environment and background  
✓ Lighting setup and quality  
✓ Camera framing baseline  
✓ Overall aesthetic  

---

## DELTA Components
What can and should change:

✓ Body position and pose  
✓ Facial expression  
✓ Hand/prop movements  
✓ Camera distance (crop/zoom)  
✓ Actions and micro-movements  
✓ New elements entering frame  

---

## Examples

### ✅ GOOD: First Frame with Avatar Reference

```
LOCKED: same avatar, white bathroom setting, 9:16 vertical, morning window light, UGC iPhone aesthetic.
DELTA: avatar standing at sink holding mascara bottle at chest height; direct eye contact with camera; neutral expression; slight smile.
```
**Word count**: 33 words ✓

---

### ✅ GOOD: Last Frame (always has first frame as reference)

```
LOCKED: same avatar and bathroom.
DELTA: mascara bottle raised to eye level; avatar examining it closely; expression shifts to curious and intrigued; head tilts slightly; catchlight in eyes.
```
**Word count**: 29 words ✓

---

### ✅ GOOD: Macro Shot

```
LOCKED: same avatar, white laboratory workspace, ring-light catchlight, 9:16 vertical, macro aesthetic.
DELTA: tighter crop focusing on right eye area; mascara wand entering from bottom right approaching lashes; eye looking slightly right; natural lash texture visible.
```
**Word count**: 36 words ✓

---

### ❌ BAD: Re-describing Everything

```
Frame now fills with avatar's right eye (70% of frame width). 28-year-old woman with olive skin and dark wavy hair. Mascara wand enters frame from bottom right. Gold wand handle catches laboratory lighting from overhead ring light positioned at 2 o'clock. Left side of frame shows continuation of white lacquer surface. Background blurs to soft bokeh revealing out-of-focus chrome fixtures and glass beakers. Eye widens showing brown iris with subtle gold flecks. Individual lashes visible in sharp detail with natural separation. Eyebrow raises 15 degrees from baseline position as wand approaches.
```
**Word count**: 98 words ✗  
**Issues**: 
- Re-describes avatar appearance already in reference
- Re-describes lighting already in reference  
- Includes precise measurements (70%, 2 o'clock, 15 degrees)
- Re-describes environment already in reference
- Way too long

---

## Special Case: Macro Shots

### ✓ DO: Describe as CROPPING
```
DELTA: tighter crop on right eye; mascara wand enters from bottom right...
```

### ✗ DON'T: Describe as ENLARGING
```
DELTA: eye now fills 70% of frame width, appearing much larger...
```

**Why**: The model interprets "enlarging" literally and creates giant objects. "Tighter crop" tells it to zoom into the existing scene.

---

## Video Prompts (Even Shorter!)

**Format**: Motion-only description  
**Word limit**: 40 words maximum

### ✅ GOOD Example
```
Avatar raises bottle from chest to eye level smoothly. Expression shifts neutral to curious. Slight head tilt. Natural movement over 2 seconds.
```
**Word count**: 23 words ✓

### ❌ BAD Example
```
The avatar, a 28-year-old woman with dark wavy hair wearing a white tank top in a bathroom with subway tiles and morning window light, slowly raises the rose gold mascara bottle from chest height to eye level while her facial expression transforms from neutral to curious and intrigued as she examines the product.
```
**Word count**: 57 words ✗  
**Issues**: Re-describes character and environment already in frame references

---

## Measurements: Intent vs. Precision

### ✓ DO: Describe Intent
- "closer crop"
- "tighter framing"
- "zoom into eye"
- "bottle moves toward camera"

### ✗ DON'T: Use Precise Numbers
- "eye at 70% of frame"
- "6mm marking"
- "2 o'clock position"
- "15 degree angle"

**Why**: Precise measurements confuse the model. Natural language works better.

---

## Realistic Actions Only

### ✓ DO: Brand-Appropriate Actions
- Applying mascara to lashes
- Showing product in hand
- Looking at results in mirror
- Demonstrating application technique

### ✗ DON'T: Unrealistic Props/Actions
- Measuring lash length with ruler
- Holding giant mascara wand
- Precise millimeter positioning
- Complex measurement demonstrations

---

## Within-Scene Consistency

### ✓ GOOD: Micro-movements in Same Setting
- Standing at sink → Sitting on tub edge (same bathroom)
- Looking in mirror → Turning to face camera (same bathroom)
- Holding product at chest → Raising to eye level (same position)

### ✗ BAD: Setting Changes Within Scene
- Bathroom → Park (location jump)
- White laboratory → Pink bedroom (setting change)
- Daytime → Nighttime (lighting shift)

**Rule**: First and last frames of the SAME scene must share the same environment.

---

## Quick Decision Tree

**Do you have a reference image?**
- **YES** → Use LOCKED/DELTA format (60-80 words)
- **NO** → Use full description (100 words max)

**Are you generating a last frame?**
- **YES** → Keep LOCKED minimal (5-10 words: "same avatar and setting")
- **NO** → Include full LOCKED list (15-20 words)

**Is this a macro/close-up shot?**
- **YES** → Describe as "tighter crop" or "zoom into existing frame"
- **NO** → Describe normally

**Are you writing a video prompt?**
- **YES** → Motion only, 40 words max, NO character/setting description
- **NO** → Standard LOCKED/DELTA format

---

## Common Mistakes to Avoid

1. **Re-listing avatar appearance** when avatar reference exists
2. **Re-describing environment** when previous frame exists
3. **Using technical measurements** ("70%", "6mm", "2 o'clock")
4. **Writing multi-paragraph prompts** (keep it short!)
5. **Describing object enlargement** for macros (describe crop instead)
6. **Including unrealistic props** (rulers, measuring tools)
7. **Changing setting within a scene** (maintain same environment)

---

## Word Count Targets

| Prompt Type | Target Word Count |
|-------------|------------------|
| First frame WITH reference | 60-80 words |
| Last frame | 50-60 words |
| Video prompt | 30-40 words |
| First frame WITHOUT reference | 80-100 words |

---

## Remember

**The reference images do the heavy lifting.**  
Your job is simply to specify what changes.

Trust the references → Shorter prompts → Better results
