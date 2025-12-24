1. Project Objective
To build a "Localhost Privacy Suite" (Redactor Pro) that allows users to redact sensitive Personally Identifiable Information (PII) from documents without uploading data to the cloud.

Primary Goal: Ensure complete data sovereignty by running all AI inference (BERT/Regex/Llama-3) locally on the user's machine.

Target Audience: Users handling sensitive "Your Money or Your Life" (YMYL) data—such as financial statements, medical records, or legal documents—who cannot risk third-party data processing.

Technical Goal: seamlessly integrate a lightweight LLM (Llama-3.2-1B via MLC) to detect context-heavy PII that traditional Regex might miss, ensuring high accuracy for compliance (GDPR/CCPA).

2. How the User Interacts (User Flow)
Based on your interface, here is the standard operating procedure (SOP) for the user:

Step 1: Initialization (The "Wait" State)
User Action: Launches the application.

System State: The sidebar shows an amber "Initializing AI..." status. The main action buttons are disabled to prevent errors.

What happens in the background: The Python backend loads the MLCEngine and weights into VRAM.

Transition: Once loaded, the status light turns Green ("System Secure" / "Ready"), and the "Process" button becomes active.

Step 2: Mode Selection
User Action: Selects a processing intensity from the sidebar.

Fast Mode: Best for simple patterns (Social Security Numbers, Phone Numbers). Uses BERT + Regex.

Deep Scan: Best for unstructured text (e.g., "Contact Miss Paula at the wood lane address"). Uses the Llama-3 model you just coded.

Step 3: Ingestion
User Action: Drags and drops a PDF into the dotted "Drag & Drop PDF here" zone or clicks to browse local files.

System Action: The app parses the PDF into raw text and displays it in the left-hand "RAW TEXT / ANALYSIS" panel.

Step 4: Review & Verification
User Action: Reviews the "Targets Found" panel (right side).

Correction (Future Feature): If the AI misses something, the user manually highlights text in the left panel to add it to the redaction list.

Visual Feedback: Detected entities in the raw text are highlighted (e.g., the pink underlines shown in your screenshot).

Step 5: Execution
User Action: Clicks the "PROCESS & REDACT PDF" button at the bottom.

System Action: The system draws black boxes over the coordinates of the identified text and exports a new PDF.