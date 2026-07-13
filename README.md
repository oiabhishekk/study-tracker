# 📚 Study & Syllabus Tracker

A premium, interactive web application to track your study progress, note-taking, revisions, practice questions, and weak areas across multiple subjects. 

Featuring visual dashboard analytics, a local-first architecture, CSV Import/Export, and automated backups via GitHub Gist.

---

## 🚀 Getting Started

Simply open `https://oiabhishekk.github.io/study-tracker/` in any web browser to get started immediately. Your progress is saved automatically on your browser (`localStorage`).

---

## 🤖 How to Import Your Own Custom Syllabus using AI

If you want to track a custom course, exam syllabus, or book, you can use any AI (like ChatGPT, Gemini, or Claude) to structure it into the tracker's format.

### Step 1: Copy the AI Prompt
Copy the prompt below and paste it into your AI assistant.

```text
Act as a CSV generator for a study tracker application.
I will provide you with a list of study topics or a syllabus.
You must output a raw CSV format (and nothing else, no markdown code blocks, no explanation text) with the exact headers:
Lecture,Phase,Topic,Class No,Completed,Notes making,Revision 1,Revision 2,Questions Solved,Weak Topic,Date Completed,Notes

For each lecture/class in the syllabus, generate a CSV row using these rules:
1. Lecture: The class/topic name (e.g., "Tenses - Class 01" or "Indus Civilisation")
2. Phase: The syllabus section or module category (e.g., "Grammar", "Ancient History", "Foundation")
3. Topic: The sub-topic or chapter name (e.g., "Tenses", "Ancient History", "Number System")
4. Class No: The chronological class number for this topic starting at 1
5. Completed: Set to "False"
6. Notes making: Set to "False"
7. Revision 1: Set to "False"
8. Revision 2: Set to "False"
9. Questions Solved: Leave empty
10. Weak Topic: Set to "False"
11. Date Completed: Leave empty
12. Notes: Leave empty

Here is the syllabus / topic list:
[PASTE YOUR SYLLABUS / TOPIC LIST HERE]
```

### Step 2: Input Your Syllabus
Replace the `[PASTE YOUR SYLLABUS / TOPIC LIST HERE]` placeholder in the prompt with your raw list of chapters, topics, YouTube playlist links, or course list, and send it to the AI.

### Step 3: Save and Import
1. The AI will output a clean text list starting with the header `Lecture,Phase,Topic...`.
2. Copy this output and paste it into a simple text file on your computer.
3. Save the file with the extension `.csv` (e.g., `my_syllabus.csv`).
4. In the Study Tracker app:
   - Select the subject tab you want to import into (e.g., Mathematics).
   - Click **Import CSV** in the top-right corner.
   - Choose your saved `.csv` file.
5. Your custom syllabus is now loaded and ready!

---

## 💡 Pro-Tips for Efficient Studying

1. **Follow the Study Funnel**:
   - Mark **Complete** when you finish watching a lecture/reading the chapter.
   - Mark **Notes Made** once your revision notes are completed.
   - Perform your **Revision 1 (R1)** and **Revision 2 (R2)** spaced reviews, and toggle them accordingly.
2. **Review your Weak Areas**: Click the **Weak Topics** filter pill to instantly focus on lectures you marked with a star (★).
3. **Track Questions Solved**: Use the `+` / `-` buttons to log practice questions. The total is tallied automatically on your dashboard.
4. **Link to the Cloud**: Click **Cloud Sync** to connect your GitHub account using a Personal Access Token. This backs up all your progress across GK, English, Maths, and Reasoning to a private GitHub Gist, allowing you to sync progress across devices!
