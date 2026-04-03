# Feature Checklist - All Updates

## ✅ Session Features (Should All Be Working)

### **1. Enhanced Detection (Backend + Frontend)**
- [ ] 75+ robust PII patterns
- [ ] Case-insensitive entity matching
- [ ] Filters short false positives (≤2 chars)
- [ ] No duplicate entities in list

### **2. PDF Viewer - Single Page Mode**
- [ ] Shows ONLY one page at a time
- [ ] Page counter shows "Page X of Y"
- [ ] Counter updates when clicking Next/Previous
- [ ] Initial load shows page 1 only

### **3. PDF Navigation**
- [ ] ‹ Previous button works
- [ ] › Next button works
- [ ] Page counter displays correctly
- [ ] Keyboard shortcuts work:
  - [ ] PageDown / → (right arrow) = Next page
  - [ ] PageUp / ← (left arrow) = Previous page
  - [ ] Ctrl+Home = First page
  - [ ] Ctrl+End = Last page

### **4. PDF Smooth Transitions**
- [ ] Pages fade in (0.3s animation)
- [ ] No "jumping" when changing pages
- [ ] PDF container has stable height

### **5. Entity List - Pagination**
- [ ] Shows 17 items per page (not 20)
- [ ] Pagination controls appear if >17 items
- [ ] "Page X of Y (1-17 of 155)" display
- [ ] ‹ › navigation buttons work
- [ ] No jumping when changing pages

### **6. Entity List - Search/Filter**
- [ ] Search bar appears above entity list
- [ ] Type to filter entities (live)
- [ ] Matching text highlighted in yellow
- [ ] × clear button works
- [ ] Shows "No matches found" if nothing matches

### **7. Entity List - Refresh Button**
- [ ] 🔄 button in panel header
- [ ] Clicking refreshes list + highlights
- [ ] Shows "Refreshed" toast

### **8. Entity List - Smooth Rendering**
- [ ] No visible flash when updating
- [ ] Stable container height
- [ ] Optimized rendering (CSS contain)

### **9. Preview Highlights**
- [ ] Entity highlights cover full text
- [ ] Word-level matching (not partial)
- [ ] Case-insensitive matching
- [ ] Red = detected, Green = manual

### **10. Redaction**
- [ ] Works with detected entities
- [ ] Case-insensitive search
- [ ] Server logs entities received
- [ ] Downloads redacted PDF

---

## 🧪 Quick Test Procedure

1. **Upload multi-page PDF** (your bank statement)
2. **Click "Scan Document"**
3. **Check counts:**
   - Target Found: Should show items (17 per page)
   - Page counter: "Page 1 of X"
4. **Test pagination:**
   - Entity list: Click › (should show items 18-34)
   - PDF viewer: Click › (should show page 2)
5. **Test search:**
   - Type "halifax" in search bar
   - Should filter and highlight
6. **Test redaction:**
   - Click "Redact & Download"
   - Should work and download PDF

---

## 🔍 If Something Is Missing

1. **Hard refresh browser:**
   - Ctrl + Shift + R (Chrome/Edge)
   - Ctrl + F5 (Firefox)
   - Clear cache if needed

2. **Check specific feature:**
   - Look at the checklist above
   - Report which specific item isn't working

3. **Check browser console:**
   - Press F12
   - Look for errors in Console tab

4. **Server logs:**
   - Check terminal running server_prod.py
   - Look for [DEBUG] or [ERROR] messages

---

## 📝 Report Format

If features are missing, please specify:

**Missing features:**
- [ ] Feature name (exact item from checklist)
- [ ] What you see vs what you expect
- [ ] Browser console errors (if any)

Example:
❌ PDF viewer shows all pages (expected: single page)
❌ Entity list shows 20 items (expected: 17 items)
✅ Search bar works
✅ Pagination works
