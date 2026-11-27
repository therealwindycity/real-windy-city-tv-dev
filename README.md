# The Real Windy City — developer copy and beta copy

This repo is a copy of the public site (https://therealwindycity.github.io/real-windy-city-tv/) with a
**click-to-comment** layer added. The public site does not have this layer.

| Copy | Address | Who it's for |
|---|---|---|
| Developer copy | https://therealwindycity.github.io/real-windy-city-tv-dev/ | The site owner. Shows every comment, with a pin on each commented spot and a running count of what is fixed and what isn't. |
| Beta copy | https://therealwindycity.github.io/real-windy-city-tv-dev/beta/ | Selected testers. They leave notes the same way; they only see their own notes. |

## How to leave a note
1. Click **💬 Comment on something** (bottom-right).
2. Click any part of the page: a button, a title, a video, a table row. It lights up in yellow, and a box opens
   telling you exactly what you clicked.
3. Pick what kind of note it is (change I want, question, something's broken, other), type it, and click **💾 Save note**.
4. Click **✓ Done commenting** to use the site normally again. (Tip: Alt + click also opens the note box.)

## Where notes go
* Each note is sent to a message relay (ntfy.sh), and a GitHub Action in this repo (`Collect site feedback`)
  files it every 5 minutes into:
  * `feedback/comments.json`: the full list, which the developer reads and updates
  * `feedback/COMMENTS.md`: the same list in plain text, with what's not fixed at the top
* Beta testers' notes also open a GitHub issue labelled `beta feedback`, so the repo owner gets an email.
  The issue closes automatically when the note is marked fixed.

## Statuses
* **Not fixed yet** (`open`)
* **Fixed — please check** (`fixed`): the developer wrote what they changed in `fixNote`. On the developer copy,
  click **👍 Looks good** to close it, or **↺ Still not right** to reopen it with another note.
* **Fixed ✓** (`confirmed`)
* **Won't change** (`wontfix`): `fixNote` explains why.

The site files in this repo are rebuilt from the live site by `make_sites.py`
(source: `rwc_feedback/` in the build workspace).
