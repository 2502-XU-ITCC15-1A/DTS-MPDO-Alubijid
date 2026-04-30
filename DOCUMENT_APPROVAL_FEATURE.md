# Document Approval Feature Implementation

## Overview
This feature adds a new approval workflow for admin users to approve or request revisions on documents sent by staff members.

## Database Changes Required

### Column Addition
You need to add a `revision_comments` column to the `documents` table in Supabase:

**SQL Migration:**
```sql
ALTER TABLE documents ADD COLUMN revision_comments TEXT DEFAULT NULL;
```

**Or in Supabase Dashboard:**
1. Go to the `documents` table
2. Click "New Column"
3. Name: `revision_comments`
4. Type: `text`
5. Set default value to: `null`

## Features Implemented

### Admin Side

#### 1. "Sent for Approval" Dashboard Card
- New stat card showing the count of documents awaiting admin approval
- Located in the statistics cards section (5 cards total)
- Purple icon with hourglass symbol

#### 2. Approval Actions (in document detail modal)
When a document has status "Sent for approval", two new buttons appear:

- **Approve Button** (green): 
  - Approves the document
  - Changes status to "Completed"
  - Adds audit log entry
  - Decreases "Sent for Approval" count

- **Revise Button** (yellow):
  - Opens a modal for entering revision comments
  - Comments are saved with the document
  - Status changes to "Pending"
  - Document sent back to staff
  - Audit log entry created

### Staff Side

#### 1. "Send for Admin Approval" Button
- Located in the document detail modal (staff view)
- When clicked:
  - Changes document status to "Sent for approval"
  - Increases admin's "Sent for Approval" count
  - Adds audit log entry
  - Shows success notification

#### 2. Revision Comments Display
- When a document has revision comments from admin:
  - Comments are displayed prominently in the document modal
  - Yellow alert box with the admin's feedback
  - Shows before the Audit Log section

#### 3. "Mark as Done" Button
- Original button still available
- Staff can mark document as done without sending for approval
- Or they can send for approval first

## Status Flow

### Document Status Changes

1. **Initial**: `Pending` → Staff assigns
2. **Sending for Approval**: `Pending` → `Sent for approval` (via "Send for Admin Approval")
3. **Admin Approves**: `Sent for approval` → `Completed` (via "Approve" button)
4. **Admin Revises**: `Sent for approval` → `Pending` + revision comments (via "Revise" button)

## Code Changes

### Files Modified

1. **shared/api.ts**
   - Added `"Sent for approval"` and `"Completed"` to `DocumentStatus` type
   - Added `revisionComments?: string` field to `Document` interface

2. **client/lib/data.ts**
   - Added `sendDocumentForApproval()` function
   - Added `approveDocument()` function
   - Added `reviseDocument()` function
   - Updated `getDocuments()` to fetch `revision_comments`
   - Updated `updateDocument()` to handle revision_comments

3. **client/pages/Dashboard.tsx**
   - Added status colors for "Sent for approval" (purple) and "Completed" (green)
   - Updated status options
   - Added "Sent for Approval" stat card
   - Added Approve/Revise buttons in document modal header
   - Added revision comments modal
   - Added revision comments display in document view
   - Updated staff-only section with "Send for Admin Approval" button
   - Updated state management with new modal and loading states

## UI Components

### New Modals

1. **Revision Comments Modal**
   - Opens when admin clicks "Revise" button
   - Contains textarea for entering comments
   - "Cancel" and "Send Revision" buttons
   - Shows note about where comments will appear

2. **Admin Comments Display**
   - Shows in document detail modal for staff
   - Yellow alert box with AlertCircle icon
   - Displays full text of revision comments

## Audit Log Entries

New audit log actions are created:

- "Sent for Admin Approval" - when staff sends document for approval
- "Document Approved" - when admin approves document
- "Document Revised" - when admin revises document with comments

## Testing Checklist

- [ ] Database migration completed (revision_comments column added)
- [ ] Admin can see "Sent for Approval" stat card
- [ ] Admin can click "Approve" button on documents with "Sent for approval" status
- [ ] Admin can click "Revise" button and enter revision comments
- [ ] Staff can click "Send for Admin Approval" button
- [ ] Staff sees revision comments when document comes back
- [ ] Document status changes correctly through all states
- [ ] Audit logs show all new actions
- [ ] Count on "Sent for Approval" card updates correctly
- [ ] Notifications (toast) show appropriate messages

## Future Enhancements

- Email notifications to staff when document is revised
- Email notifications to admin when document is sent for approval
- Comments history/versioning
- Automatic status updates when documents are completed
- Batch approval actions for multiple documents
