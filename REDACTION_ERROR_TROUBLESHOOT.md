# Redaction Error Troubleshoot Guide

## Error: "No entities to redact"

This error occurs when the redaction button is clicked but no entities are being sent to the server.

### Possible Causes:

1. **Entity list is empty**
   - You haven't run a scan yet
   - All entities were removed from the list
   - Scan completed but found 0 items

2. **Entities not collected properly**
   - Bug in entity collection code
   - detectedEntities array is empty
   - manualEntities array is empty

3. **Data not sent to server**
   - FormData not including 'words' parameter
   - EntityTexts array empty before sending

### Debug Steps:

1. **Check if entities are detected:**
   - Look at "Targets Found" count
   - Should show "X items" (not "0 items")

2. **Check browser console:**
   - Open DevTools (F12)
   - Look for the error details
   - Check Network tab → redact request → Form Data

3. **Check server logs:**
   - Look for "[DEBUG] Received words parameter"
   - Should show the entity list being sent
   - If empty, frontend isn't sending data

### How to Fix:

**If no entities detected:**
1. Upload a PDF
2. Click "Scan Document"
3. Wait for scan to complete
4. Check "Targets Found" panel has items
5. Then click "Redact & Download"

**If entities shown but redaction fails:**
1. Refresh browser (Ctrl + F5)
2. Clear browser cache
3. Re-upload PDF and scan
4. Try again

### Server Logging Added:

The server now logs:
- `[DEBUG] Received words parameter: '<value>'`
- `[DEBUG] Parsed X words: [list]`
- `[ERROR] No entities received from client` (if empty)

Check the terminal where the server is running to see these logs!
