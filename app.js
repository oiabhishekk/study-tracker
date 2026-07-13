// CSV Parsing Utility (handles quotes, double-quotes, commas, newlines)
function parseCSV(text) {
    const lines = [];
    let row = [""];
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i + 1];

        if (c === '"') {
            if (inQuotes && next === '"') {
                row[row.length - 1] += '"';
                i++; // Skip the next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (c === ',' && !inQuotes) {
            row.push("");
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
            if (c === '\r' && next === '\n') i++;
            lines.push(row);
            row = [""];
        } else {
            row[row.length - 1] += c;
        }
    }
    if (row.length > 1 || row[0] !== "") {
        lines.push(row);
    }
    return lines;
}

// Convert state array back to CSV string
function stateToCSV(lecturesList) {
    const headers = [
        "Lecture", "Phase", "Topic", "Class No", "Completed",
        "Notes making", "Revision 1", "Revision 2", "Questions Solved", "Weak Topic",
        "Date Completed", "Notes"
    ];

    const rows = lecturesList.map(l => {
        const escape = (val) => {
            if (val === null || val === undefined) return '';
            let str = String(val);
            if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        return [
            escape(l.lecture),
            escape(l.phase),
            escape(l.topic),
            l.classNo,
            l.completed ? "True" : "False",
            l.notesMaking ? "True" : "False",
            l.revision1 ? "True" : "False",
            l.revision2 ? "True" : "False",
            l.questionsSolved !== null ? l.questionsSolved : '',
            l.weakTopic ? "True" : "False",
            escape(l.dateCompleted),
            escape(l.notes)
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}

// Application State
let lectures = [];
let currentSubject = "maths"; // "maths", "gk", "reasoning", "english"
let currentFilterPhase = "All"; // Dynamic categories depending on active subject
let currentFilterStatus = "All"; // "All", "Completed", "Pending", "Rev1", "Rev2", "Weak"
let currentFilterTopic = "All";
let searchQuery = "";
let currentEditingIndex = null; // For the notes drawer

// Cloud Sync State
let githubToken = localStorage.getItem('ssc_maths_github_token') || '';
let gistId = localStorage.getItem('ssc_maths_gist_id') || '';
let syncStatus = 'local'; // 'local', 'syncing', 'synced', 'error'
let syncTimeout = null;

// Initialize App
window.addEventListener('DOMContentLoaded', () => {
    // Theme setup
    const savedTheme = localStorage.getItem('ssc_maths_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.getElementById('theme-icon');
    if (themeIcon) {
        updateThemeIcon(savedTheme);
    }

    // Set initial subject color theme on html tag
    document.documentElement.setAttribute('data-subject', currentSubject);

    // Load Data
    loadState();

    // Initialize Cloud Sync Settings and Badge
    loadCloudSettingsState();

    // Populate dynamic filter tabs based on active subject
    populatePhaseTabs();

    // Populate Dynamic Filters
    populateTopicFilter();

    // Bind Event Listeners
    setupEventListeners();

    // Initial Render
    updateDashboard();
    renderLectures();

    // Auto-pull from cloud on start if configured
    if (githubToken && gistId) {
        pullFromCloud();
    }
});

// Load progress state from localStorage or default CSV
function loadState() {
    const key = `ssc_${currentSubject}_progress`;
    const saved = localStorage.getItem(key);
    if (saved) {
        try {
            lectures = JSON.parse(saved);
        } catch (e) {
            console.error(`Error parsing saved progress state for ${currentSubject}. Reloading defaults.`, e);
            loadDefaults();
        }
    } else {
        loadDefaults();
    }
}

// Load default data from raw CSV variables
function loadDefaults() {
    let rawData;
    if (currentSubject === 'maths') {
        rawData = typeof defaultCsvData !== 'undefined' ? defaultCsvData : '';
    } else if (currentSubject === 'gk') {
        rawData = typeof defaultGkCsv !== 'undefined' ? defaultGkCsv : '';
    } else if (currentSubject === 'reasoning') {
        rawData = typeof defaultReasoningCsv !== 'undefined' ? defaultReasoningCsv : '';
    } else if (currentSubject === 'english') {
        rawData = typeof defaultEnglishCsv !== 'undefined' ? defaultEnglishCsv : '';
    }

    if (!rawData) {
        console.error(`Default data not found for subject: ${currentSubject}`);
        return;
    }

    const parsed = parseCSV(rawData);
    if (parsed.length <= 1) {
        console.error("Parsed CSV is empty or invalid.");
        return;
    }

    // Skip header row
    lectures = parsed.slice(1)
        .filter(row => row.length >= 4 && row[0].trim() !== "")
        .map((row, idx) => {
            return {
                id: idx,
                lecture: row[0],
                phase: row[1],
                topic: row[2],
                classNo: parseInt(row[3]) || 0,
                completed: row[4] === 'True',
                notesMaking: row[5] === 'True',
                revision1: row[6] === 'True',
                revision2: row[7] === 'True',
                questionsSolved: row[8] ? parseInt(row[8]) || 0 : 0,
                weakTopic: row[9] === 'True',
                dateCompleted: row[10] || "",
                notes: row[11] || ""
            };
        });

    saveState();
}

function saveState() {
    const key = `ssc_${currentSubject}_progress`;
    localStorage.setItem(key, JSON.stringify(lectures));
    triggerAutoSync();
}

// Switch between subjects
function switchSubject(subject) {
    currentSubject = subject;

    // Update HTML attribute for dynamic color styling overrides
    document.documentElement.setAttribute('data-subject', subject);

    // Update headers and search bar labels
    const titleEl = document.getElementById('subject-title');
    const descEl = document.getElementById('subject-desc');
    const nextLabel = document.querySelector('#next-up-container').parentElement.querySelector('.stat-label');

    if (titleEl) titleEl.textContent = "Study Tracker";
    document.title = "Study Tracker";

    if (subject === 'maths') {
        if (descEl) descEl.textContent = "Mathematics progress, revision, and syllabus mastery";
        if (nextLabel) nextLabel.textContent = "Next Lecture";
    } else if (subject === 'gk') {
        if (descEl) descEl.textContent = "History, Geography, Polity, Science & General Awareness";
        if (nextLabel) nextLabel.textContent = "Next Topic";
    } else if (subject === 'reasoning') {
        if (descEl) descEl.textContent = "Time practice, visual, logical, and analytical topics";
        if (nextLabel) nextLabel.textContent = "Next Topic";
    } else if (subject === 'english') {
        if (descEl) descEl.textContent = "Grammar rules, vocabulary lists, and comprehensions";
        if (nextLabel) nextLabel.textContent = "Next Topic";
    }

    // Reset filters
    currentFilterPhase = "All";
    currentFilterStatus = "All";
    currentFilterTopic = "All";
    searchQuery = "";

    // Clear inputs in DOM
    document.getElementById('search-input').value = '';
    document.querySelectorAll('.pill-btn').forEach(b => {
        if (b.getAttribute('data-status') === 'All') b.classList.add('active');
        else b.classList.remove('active');
    });

    // Re-initialize dynamic layout components
    loadState();
    populatePhaseTabs();
    populateTopicFilter();
    updateDashboard();
    renderLectures();
}

// Populate search filter phase tabs dynamically based on category groupings of the active subject
function populatePhaseTabs() {
    const tabContainer = document.querySelector('.filter-tabs');
    if (!tabContainer) return;

    const phases = [...new Set(lectures.map(l => l.phase))].filter(Boolean);

    let html = `<button class="tab-btn active" data-phase="All">All Parts</button>`;
    phases.forEach(phase => {
        html += `<button class="tab-btn" data-phase="${phase}">${phase}</button>`;
    });

    tabContainer.innerHTML = html;

    // Re-bind listeners to newly created tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilterPhase = e.currentTarget.getAttribute('data-phase');
            renderLectures();
        });
    });
}

// Extract unique topics to fill select filter dropdown
function populateTopicFilter() {
    const topicSelect = document.getElementById('topic-filter');
    if (!topicSelect) return;

    // Get unique topics sorted alphabetically
    const topics = [...new Set(lectures.map(l => l.topic))].filter(Boolean).sort();

    // Clear and add "All Topics"
    topicSelect.innerHTML = '<option value="All">All Topics</option>';

    topics.forEach(topic => {
        const option = document.createElement('option');
        option.value = topic;
        option.textContent = topic;
        topicSelect.appendChild(option);
    });
}

// Compute Statistics & Update Widgets
function updateDashboard() {
    const total = lectures.length;
    const completed = lectures.filter(l => l.completed).length;
    const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Notes and Revisions
    const notesMade = lectures.filter(l => l.notesMaking).length;
    const rev1 = lectures.filter(l => l.revision1).length;
    const rev2 = lectures.filter(l => l.revision2).length;
    const notesPercent = completed > 0 ? Math.round((notesMade / completed) * 100) : 0;
    const rev1Percent = completed > 0 ? Math.round((rev1 / completed) * 100) : 0;
    const rev2Percent = completed > 0 ? Math.round((rev2 / completed) * 100) : 0;

    // Questions and Weak Areas
    const totalQuestions = lectures.reduce((sum, l) => sum + (l.questionsSolved || 0), 0);
    const weakTopics = lectures.filter(l => l.weakTopic).length;

    // Streak calculation
    const streak = calculateStreak();

    // Next Suggestion
    const nextLecture = lectures.find(l => !l.completed);

    // Update DOM Stats
    document.getElementById('total-stats-value').textContent = `${completed}/${total}`;
    document.getElementById('progress-percent-text').textContent = `${progressPercent}%`;

    // Circular Progress stroke transition
    const circle = document.getElementById('progress-ring-circle');
    if (circle) {
        const radius = circle.r.baseVal.value;
        const circumference = 2 * Math.PI * radius;
        circle.style.strokeDasharray = `${circumference} ${circumference}`;
        const offset = circumference - (progressPercent / 100) * circumference;
        circle.style.strokeDashoffset = offset;
    }

    // Update Revisions/Notes Progress
    document.getElementById('notes-stats-label').textContent = `${notesMade}/${completed}`;
    document.getElementById('notes-progress-fill').style.width = `${notesPercent}%`;
    document.getElementById('rev1-stats-label').textContent = `${rev1}/${completed}`;
    document.getElementById('rev1-progress-fill').style.width = `${rev1Percent}%`;
    document.getElementById('rev2-stats-label').textContent = `${rev2}/${completed}`;
    document.getElementById('rev2-progress-fill').style.width = `${rev2Percent}%`;

    // Update Questions & Weak
    document.getElementById('questions-stats-value').textContent = totalQuestions;
    document.getElementById('weak-stats-value').textContent = weakTopics;

    // Update Streak
    document.getElementById('streak-value').textContent = streak;

    // Update Next Up Widget
    const nextContainer = document.getElementById('next-up-container');
    if (nextLecture) {
        nextContainer.innerHTML = `
            <div class="next-up-action">
                <div class="stat-content">
                    <span class="next-title">${nextLecture.lecture}</span>
                    <span class="next-topic">${nextLecture.phase} • ${nextLecture.topic}</span>
                </div>
                <button class="btn btn-primary btn-icon" id="quick-complete-next" data-id="${nextLecture.id}" title="Mark Complete">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </button>
            </div>
        `;
        document.getElementById('quick-complete-next').addEventListener('click', (e) => {
            const id = parseInt(e.currentTarget.getAttribute('data-id'));
            toggleComplete(id, true);
        });
    } else {
        nextContainer.innerHTML = `
            <div class="next-up-action">
                <div class="stat-content">
                    <span class="next-title" style="color: var(--success)">🎉 Syllabus Complete!</span>
                    <span class="next-topic">All modules completed</span>
                </div>
            </div>
        `;
    }

    // Update Phase Breakdown Grid
    updatePhaseStats();
}

// Generate phase progress bars dynamically based on active subject phase groupings
function updatePhaseStats() {
    const container = document.getElementById('phase-cards-container');
    if (!container) return;

    container.innerHTML = '';

    const phases = [];
    lectures.forEach(l => {
        if (!phases.includes(l.phase)) {
            phases.push(l.phase);
        }
    });

    phases.forEach((phase, idx) => {
        const phaseLectures = lectures.filter(l => l.phase === phase);
        const total = phaseLectures.length;
        const completed = phaseLectures.filter(l => l.completed).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

        let gradient = 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)';
        if (currentSubject === 'gk') {
            gradient = 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)';
        } else if (currentSubject === 'reasoning') {
            gradient = 'linear-gradient(135deg, #a855f7 0%, #7c3aed 100%)';
        } else if (currentSubject === 'english') {
            gradient = 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)';
        }

        const card = document.createElement('div');
        card.className = 'phase-card';
        card.innerHTML = `
            <div class="phase-card-header">
                <span class="phase-name">${phase}</span>
                <span class="phase-badge foundation" style="background: rgba(99, 102, 241, 0.1); color: var(--primary); font-size:0.65rem;">Part ${idx + 1}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%; background: ${gradient}"></div>
            </div>
            <div class="phase-stats">
                <span>Topics Completed:</span>
                <span style="font-weight:700;">${completed}/${total} (${percent}%)</span>
            </div>
        `;
        container.appendChild(card);
    });
}

// Calculate study streak based on completion dates
function calculateStreak() {
    const dates = lectures
        .map(l => l.dateCompleted)
        .filter(d => d && /^\d{4}-\d{2}-\d{2}$/.test(d)) // Validate YYYY-MM-DD
        .sort();

    if (dates.length === 0) return 0;

    const uniqueDates = [...new Set(dates)];

    const dateObjs = uniqueDates.map(d => {
        const [year, month, day] = d.split('-').map(Number);
        return new Date(year, month - 1, day);
    });

    dateObjs.sort((a, b) => b - a);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let latestCompletion = dateObjs[0];

    if (latestCompletion < yesterday) {
        return 0;
    }

    let streak = 1;
    let currentCheck = latestCompletion;

    for (let i = 1; i < dateObjs.length; i++) {
        const prevDay = new Date(currentCheck);
        prevDay.setDate(prevDay.getDate() - 1);

        if (dateObjs[i].getTime() === prevDay.getTime()) {
            streak++;
            currentCheck = dateObjs[i];
        } else {
            break;
        }
    }

    return streak;
}

// Render filtered lectures table
function renderLectures() {
    const tbody = document.getElementById('lectures-list');
    if (!tbody) return;

    tbody.innerHTML = '';

    // Apply filters
    const filtered = lectures.filter(l => {
        // Search Filter
        const query = searchQuery.toLowerCase().trim();
        const matchesSearch = query === "" ||
            l.lecture.toLowerCase().includes(query) ||
            l.topic.toLowerCase().includes(query);

        // Phase Filter
        const matchesPhase = currentFilterPhase === "All" || l.phase === currentFilterPhase;

        // Topic Filter
        const matchesTopic = currentFilterTopic === "All" || l.topic === currentFilterTopic;

        // Status Filter
        let matchesStatus = true;
        if (currentFilterStatus === "Completed") {
            matchesStatus = l.completed;
        } else if (currentFilterStatus === "Pending") {
            matchesStatus = !l.completed;
        } else if (currentFilterStatus === "NotesPending") {
            matchesStatus = l.completed && !l.notesMaking;
        } else if (currentFilterStatus === "Rev1") {
            matchesStatus = l.completed && !l.revision1;
        } else if (currentFilterStatus === "Rev2") {
            matchesStatus = l.completed && l.revision1 && !l.revision2;
        } else if (currentFilterStatus === "Weak") {
            matchesStatus = l.weakTopic;
        }

        return matchesSearch && matchesPhase && matchesTopic && matchesStatus;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9">
                    <div class="empty-state">
                        No items match the active filters or search criteria.
                    </div>
                </td>
            </tr>
        `;
        document.getElementById('showing-count').textContent = `Showing 0 items`;
        return;
    }

    const itemLabel = currentSubject === "maths" ? "lectures" : "topics";
    document.getElementById('showing-count').textContent = `Showing ${filtered.length} of ${lectures.length} ${itemLabel}`;

    // Render Rows (dynamically generated for optimal speed)
    const fragment = document.createDocumentFragment();

    filtered.forEach(l => {
        const tr = document.createElement('tr');
        tr.id = `row-${l.id}`;
        if (l.completed) tr.classList.add('completed-row');

        // Class No & Phase Badge
        const classNoCell = document.createElement('td');
        const countIndexPrefix = currentSubject === "maths" ? "Class" : "Item";
        classNoCell.innerHTML = `
            <div style="font-weight: 700;">#${l.classNo}</div>
            <span class="phase-badge ${l.phase.toLowerCase().replace(/[^a-z]/g, '')}" style="font-size: 0.65rem; padding: 2px 5px;">${l.phase}</span>
        `;
        tr.appendChild(classNoCell);

        // Title
        const titleCell = document.createElement('td');
        titleCell.style.fontWeight = '500';
        titleCell.textContent = l.lecture;
        tr.appendChild(titleCell);

        // Topic Pill
        const topicCell = document.createElement('td');
        topicCell.innerHTML = `<span class="topic-pill">${l.topic}</span>`;
        tr.appendChild(topicCell);

        // Completed toggle
        const statusCell = document.createElement('td');
        statusCell.innerHTML = `
            <label class="toggle-switch">
                <input type="checkbox" ${l.completed ? 'checked' : ''} onchange="toggleComplete(${l.id}, this.checked)">
                <span class="toggle-slider"></span>
            </label>
        `;
        tr.appendChild(statusCell);

        // Notes making toggle
        const notesMakingCell = document.createElement('td');
        const notesMakingDisabled = !l.completed ? 'disabled style="opacity: 0.4; pointer-events: none;"' : '';
        notesMakingCell.innerHTML = `
            <button class="notes-making-btn ${l.notesMaking ? 'active' : ''}" ${notesMakingDisabled} onclick="toggleNotesMaking(${l.id}, !${l.notesMaking})" title="Notes Made">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                    <polyline points="10 9 9 9 8 9"></polyline>
                </svg>
            </button>
        `;
        tr.appendChild(notesMakingCell);

        // Revisions Checkboxes
        const revCell = document.createElement('td');
        const disabledAttr = !l.completed ? 'style="opacity: 0.4; pointer-events: none;"' : '';
        revCell.innerHTML = `
            <div class="revision-checkboxes" ${disabledAttr}>
                <div class="rev-checkbox ${l.revision1 ? 'active' : ''}" onclick="toggleRevision(${l.id}, 1)" title="Revision 1">R1</div>
                <div class="rev-checkbox ${l.revision2 ? 'active rev2' : ''}" onclick="toggleRevision(${l.id}, 2)" title="Revision 2">R2</div>
            </div>
        `;
        tr.appendChild(revCell);

        // Questions Count input
        const qCell = document.createElement('td');
        qCell.innerHTML = `
            <div class="question-counter">
                <button type="button" onclick="adjustQuestions(${l.id}, -5)">-</button>
                <input type="number" id="questions-${l.id}" value="${l.questionsSolved || 0}" min="0" onchange="setQuestions(${l.id}, this.value)">
                <button type="button" onclick="adjustQuestions(${l.id}, 5)">+</button>
            </div>
        `;
        tr.appendChild(qCell);

        // Weak Topic star
        const weakCell = document.createElement('td');
        weakCell.innerHTML = `
            <button class="weak-toggle ${l.weakTopic ? 'active' : ''}" onclick="toggleWeak(${l.id})" title="Toggle Weak Topic">
                ${l.weakTopic ? '★' : '☆'}
            </button>
        `;
        tr.appendChild(weakCell);

        // Date & Notes drawer button
        const actionCell = document.createElement('td');
        const notesClass = l.notes ? 'has-notes' : '';
        const notesTitle = l.notes ? 'Edit Notes (Has content)' : 'Add Notes';

        actionCell.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                <span class="date-badge">${l.dateCompleted ? formatDate(l.dateCompleted) : '--'}</span>
                <button class="notes-btn ${notesClass}" onclick="openNotesDrawer(${l.id})" title="${notesTitle}">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 20h9"></path>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
                    </svg>
                </button>
            </div>
        `;
        tr.appendChild(actionCell);

        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
}

// Helpers
function formatDate(dateStr) {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}`;
}

// Toggle Complete Checkbox
function toggleComplete(id, completed) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture) return;

    lecture.completed = completed;
    if (completed) {
        if (!lecture.dateCompleted) {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            lecture.dateCompleted = `${year}-${month}-${day}`;
        }
    } else {
        lecture.notesMaking = false;
        lecture.revision1 = false;
        lecture.revision2 = false;
        lecture.dateCompleted = "";
    }

    saveState();
    updateDashboard();

    const tr = document.getElementById(`row-${id}`);
    if (tr) {
        if (completed) {
            tr.classList.add('completed-row');
        } else {
            tr.classList.remove('completed-row');
        }
        renderLectures();
    }
}

// Toggle Notes Making Checkbox
function toggleNotesMaking(id, notesMaking) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture || !lecture.completed) return;

    lecture.notesMaking = notesMaking;
    saveState();
    updateDashboard();
    renderLectures();
}

// Toggle Revision R1 or R2
function toggleRevision(id, revNumber) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture || !lecture.completed) return;

    if (revNumber === 1) {
        lecture.revision1 = !lecture.revision1;
        if (!lecture.revision1) lecture.revision2 = false;
    } else if (revNumber === 2) {
        if (!lecture.revision1) {
            showToast("Complete Revision 1 first!", "warning");
            return;
        }
        lecture.revision2 = !lecture.revision2;
    }

    saveState();
    updateDashboard();
    renderLectures();
}

// Adjust Questions Solved Count
function adjustQuestions(id, delta) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture) return;

    let val = (lecture.questionsSolved || 0) + delta;
    if (val < 0) val = 0;

    lecture.questionsSolved = val;

    const input = document.getElementById(`questions-${id}`);
    if (input) input.value = val;

    saveState();
    updateDashboard();
}

// Directly Set Questions Solved
function setQuestions(id, value) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture) return;

    let val = parseInt(value);
    if (isNaN(val) || val < 0) val = 0;

    lecture.questionsSolved = val;

    saveState();
    updateDashboard();
}

// Toggle Weak Topic Star
function toggleWeak(id) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture) return;

    lecture.weakTopic = !lecture.weakTopic;

    saveState();
    updateDashboard();
    renderLectures();
}

// Open Notes Side Drawer
window.openNotesDrawer = function (id) {
    const lecture = lectures.find(l => l.id === id);
    if (!lecture) return;

    currentEditingIndex = id;

    document.getElementById('drawer-lecture-title').textContent = lecture.lecture;
    document.getElementById('drawer-phase-topic').textContent = `${lecture.phase} • ${lecture.topic}`;

    document.getElementById('drawer-date').value = lecture.dateCompleted || '';
    document.getElementById('drawer-notes').value = lecture.notes || '';

    document.getElementById('drawer-backdrop').classList.add('active');
    document.getElementById('drawer').classList.add('active');
};

// Close Notes Side Drawer
function closeNotesDrawer() {
    document.getElementById('drawer-backdrop').classList.remove('active');
    document.getElementById('drawer').classList.remove('active');
    currentEditingIndex = null;
}

// Save Notes Drawer changes
function saveNotes() {
    if (currentEditingIndex === null) return;

    const lecture = lectures.find(l => l.id === currentEditingIndex);
    if (!lecture) return;

    const dateVal = document.getElementById('drawer-date').value;
    const notesVal = document.getElementById('drawer-notes').value;

    lecture.dateCompleted = dateVal;
    lecture.notes = notesVal;

    if (dateVal && !lecture.completed) {
        lecture.completed = true;
    }

    saveState();
    updateDashboard();
    renderLectures();
    closeNotesDrawer();
    showToast("Notes saved successfully!");
}

// Show toast notifications
function showToast(message, type = "success") {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;

    if (type === "success") {
        toast.style.background = "var(--success-gradient)";
        toast.style.boxShadow = "0 10px 25px rgba(16, 185, 129, 0.3)";
    } else if (type === "warning") {
        toast.style.background = "var(--warning-gradient)";
        toast.style.boxShadow = "0 10px 25px rgba(245, 158, 11, 0.3)";
    }

    toast.classList.add('active');

    setTimeout(() => {
        toast.classList.remove('active');
    }, 3000);
}

// Update icon on Theme Toggle
function updateThemeIcon(theme) {
    const icon = document.getElementById('theme-icon');
    if (theme === 'dark') {
        icon.innerHTML = `
            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z"></path>
        `;
    } else {
        icon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
    }
}

// Bind all events
function setupEventListeners() {
    // Subject Tabs Navigation
    document.querySelectorAll('.subj-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.subj-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const subject = e.currentTarget.getAttribute('data-subject');
            switchSubject(subject);
        });
    });

    // Theme Toggle
    document.getElementById('theme-toggle').addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', nextTheme);
        localStorage.setItem('ssc_maths_theme', nextTheme);
        updateThemeIcon(nextTheme);
    });

    // Search
    document.getElementById('search-input').addEventListener('input', (e) => {
        searchQuery = e.target.value;
        renderLectures();
    });

    // Status filter pills (Completed, Pending, R1 Pending, R2 Pending, Weak)
    document.querySelectorAll('.pill-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
            e.currentTarget.classList.add('active');
            currentFilterStatus = e.currentTarget.getAttribute('data-status');
            renderLectures();
        });
    });

    // Topic Selector
    document.getElementById('topic-filter').addEventListener('change', (e) => {
        currentFilterTopic = e.target.value;
        renderLectures();
    });

    // Drawer handlers
    document.getElementById('drawer-backdrop').addEventListener('click', closeNotesDrawer);
    document.getElementById('drawer-close').addEventListener('click', closeNotesDrawer);
    document.getElementById('drawer-cancel').addEventListener('click', closeNotesDrawer);
    document.getElementById('drawer-save').addEventListener('click', saveNotes);

    // Export CSV (Subject-specific download naming)
    document.getElementById('btn-export').addEventListener('click', () => {
        try {
            const csvContent = stateToCSV(lectures);
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `SSC_${currentSubject.toUpperCase()}_Notion_Import.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            showToast(`${currentSubject.toUpperCase()} CSV Exported!`);
        } catch (e) {
            console.error(e);
            showToast("Export failed!", "warning");
        }
    });

    // Import CSV File Selector (Imports into active subject)
    document.getElementById('csv-file-picker').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function (evt) {
            try {
                const text = evt.target.result;
                const parsed = parseCSV(text);

                if (parsed.length <= 1) {
                    showToast("Uploaded CSV is empty!", "warning");
                    return;
                }

                const headers = parsed[0].map(h => h.trim().toLowerCase());
                if (!headers.includes("lecture") || !headers.includes("phase") || !headers.includes("topic")) {
                    showToast("Invalid CSV structure. Missing columns!", "warning");
                    return;
                }

                const lectureIdx = headers.indexOf("lecture");
                const phaseIdx = headers.indexOf("phase");
                const topicIdx = headers.indexOf("topic");
                const classNoIdx = headers.indexOf("class no");
                const completedIdx = headers.indexOf("completed");
                const notesMakingIdx = headers.indexOf("notes making");
                const rev1Idx = headers.indexOf("revision 1");
                const rev2Idx = headers.indexOf("revision 2");
                const questionsIdx = headers.indexOf("questions solved");
                const weakIdx = headers.indexOf("weak topic");
                const dateIdx = headers.indexOf("date completed");
                const notesIdx = headers.indexOf("notes");

                lectures = parsed.slice(1)
                    .filter(row => row.length >= 4 && row[lectureIdx].trim() !== "")
                    .map((row, idx) => {
                        return {
                            id: idx,
                            lecture: row[lectureIdx],
                            phase: row[phaseIdx],
                            topic: row[topicIdx],
                            classNo: classNoIdx !== -1 ? parseInt(row[classNoIdx]) || 0 : 0,
                            completed: completedIdx !== -1 ? (row[completedIdx] === 'True' || row[completedIdx] === 'true' || row[completedIdx] === '1') : false,
                            notesMaking: notesMakingIdx !== -1 ? (row[notesMakingIdx] === 'True' || row[notesMakingIdx] === 'true' || row[notesMakingIdx] === '1') : false,
                            revision1: rev1Idx !== -1 ? (row[rev1Idx] === 'True' || row[rev1Idx] === 'true' || row[rev1Idx] === '1') : false,
                            revision2: rev2Idx !== -1 ? (row[rev2Idx] === 'True' || row[rev2Idx] === 'true' || row[rev2Idx] === '1') : false,
                            questionsSolved: (questionsIdx !== -1 && row[questionsIdx]) ? parseInt(row[questionsIdx]) || 0 : 0,
                            weakTopic: weakIdx !== -1 ? (row[weakIdx] === 'True' || row[weakIdx] === 'true' || row[weakIdx] === '1') : false,
                            dateCompleted: dateIdx !== -1 ? row[dateIdx] : "",
                            notes: notesIdx !== -1 ? row[notesIdx] : ""
                        };
                    });

                saveState();
                populatePhaseTabs();
                populateTopicFilter();
                updateDashboard();
                renderLectures();
                showToast(`CSV imported into ${currentSubject.toUpperCase()} successfully!`);
            } catch (err) {
                console.error(err);
                showToast("Failed to parse CSV!", "warning");
            }
        };
        reader.readAsText(file);
    });

    // Reset defaults button (Resets active subject)
    document.getElementById('btn-reset').addEventListener('click', () => {
        const confirmStr = prompt(`WARNING: This will reset all progress for ${currentSubject.toUpperCase()} to default!\nTo confirm, please type "yesiwanttoresetthis":`);
        if (confirmStr === "yesiwanttoresetthis") {
            const key = `ssc_${currentSubject}_progress`;
            localStorage.removeItem(key);
            loadState();
            populatePhaseTabs();
            populateTopicFilter();
            updateDashboard();
            renderLectures();
            showToast(`${currentSubject.toUpperCase()} reset successfully!`);
        } else if (confirmStr !== null) {
            showToast("Reset cancelled: confirmation did not match.", "warning");
        }
    });

    // Cloud Sync event listeners
    document.getElementById('btn-cloud-settings').addEventListener('click', openCloudDrawer);
    document.getElementById('cloud-drawer-close').addEventListener('click', closeCloudDrawer);
    document.getElementById('cloud-drawer-cancel').addEventListener('click', closeCloudDrawer);
    document.getElementById('cloud-backdrop').addEventListener('click', closeCloudDrawer);
    document.getElementById('btn-create-gist').addEventListener('click', createCloudGist);
    document.getElementById('btn-link-gist').addEventListener('click', linkCloudGist);
    document.getElementById('btn-cloud-pull').addEventListener('click', pullFromCloud);
    document.getElementById('btn-cloud-push').addEventListener('click', () => pushToCloud(false));
    document.getElementById('cloud-drawer-disconnect').addEventListener('click', disconnectCloud);
    document.getElementById('cloud-drawer-save').addEventListener('click', saveCloudSettings);
}

// Load cloud settings from LocalStorage and update UI status
function loadCloudSettingsState() {
    githubToken = localStorage.getItem('ssc_maths_github_token') || '';
    gistId = localStorage.getItem('ssc_maths_gist_id') || '';

    document.getElementById('cloud-token').value = githubToken;
    document.getElementById('cloud-gist-id').value = gistId;

    if (githubToken && gistId) {
        updateSyncStatus('synced');
    } else {
        updateSyncStatus('local');
    }
}

// Open settings drawer
function openCloudDrawer() {
    document.getElementById('cloud-token').value = githubToken;
    document.getElementById('cloud-gist-id').value = gistId;
    updateSyncControls();

    document.getElementById('cloud-backdrop').classList.add('active');
    document.getElementById('cloud-drawer').classList.add('active');
}

// Close settings drawer
function closeCloudDrawer() {
    document.getElementById('cloud-backdrop').classList.remove('active');
    document.getElementById('cloud-drawer').classList.remove('active');
}

// GitHub API Fetch wrapper
async function githubRequest(method, path, body = null) {
    if (!githubToken) throw new Error("No token provided");
    const headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${githubToken}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json"
    };
    const config = { method, headers };
    if (body) {
        config.body = JSON.stringify(body);
    }
    const response = await fetch(`https://api.github.com${path}`, config);
    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.message || `GitHub request failed with code ${response.status}`);
    }
    return response.json();
}

// Update UI depending on Sync Status
function updateSyncStatus(status) {
    syncStatus = status;
    const btn = document.getElementById('btn-cloud-settings');
    const icon = document.getElementById('cloud-status-icon');
    const text = document.getElementById('cloud-status-text');

    if (!btn || !icon || !text) return;

    btn.classList.remove('btn-cloud-synced', 'btn-cloud-syncing', 'btn-cloud-error');
    icon.classList.remove('syncing-spin');

    if (status === 'synced') {
        btn.classList.add('btn-cloud-synced');
        text.textContent = "Synced";
        icon.textContent = "☁️";
    } else if (status === 'syncing') {
        btn.classList.add('btn-cloud-syncing');
        text.textContent = "Syncing...";
        icon.textContent = "🔄";
        icon.classList.add('syncing-spin');
    } else if (status === 'error') {
        btn.classList.add('btn-cloud-error');
        text.textContent = "Sync Error";
        icon.textContent = "⚠️";
    } else {
        text.textContent = "Cloud Sync";
        icon.textContent = "☁️";
    }
}

// Enable/Disable drawer buttons based on auth status
function updateSyncControls() {
    const hasConfig = githubToken && gistId;
    document.getElementById('btn-cloud-pull').disabled = !hasConfig;
    document.getElementById('btn-cloud-push').disabled = !hasConfig;

    const disconnectBtn = document.getElementById('cloud-drawer-disconnect');
    if (disconnectBtn) {
        disconnectBtn.style.display = hasConfig ? 'inline-flex' : 'none';
    }
}

// Create new secret Gist containing files for all four subjects
async function createCloudGist() {
    const inputToken = document.getElementById('cloud-token').value.trim();
    if (!inputToken) {
        showToast("GitHub Personal Access Token is required to create a Gist!", "warning");
        return;
    }

    githubToken = inputToken;
    updateSyncStatus('syncing');

    try {
        const getSubjectCSV = (subject) => {
            if (subject === currentSubject) {
                return stateToCSV(lectures);
            }
            const saved = localStorage.getItem(`ssc_${subject}_progress`);
            if (saved) {
                try {
                    return stateToCSV(JSON.parse(saved));
                } catch (e) { }
            }

            let rawData = '';
            if (subject === 'maths') rawData = typeof defaultCsvData !== 'undefined' ? defaultCsvData : '';
            else if (subject === 'gk') rawData = typeof defaultGkCsv !== 'undefined' ? defaultGkCsv : '';
            else if (subject === 'reasoning') rawData = typeof defaultReasoningCsv !== 'undefined' ? defaultReasoningCsv : '';
            else if (subject === 'english') rawData = typeof defaultEnglishCsv !== 'undefined' ? defaultEnglishCsv : '';

            const parsed = parseCSV(rawData);
            const dummy = parsed.slice(1).map((row, idx) => ({
                lecture: row[0], phase: row[1], topic: row[2], classNo: parseInt(row[3]) || 0,
                completed: false, notesMaking: false, revision1: false, revision2: false, questionsSolved: 0,
                weakTopic: false, dateCompleted: "", notes: ""
            }));
            return stateToCSV(dummy);
        };

        const body = {
            description: "Study Tracker Progress Multi-Subject Backup",
            public: false,
            files: {
                "SSC_Maths_Notion_Import.csv": { "content": getSubjectCSV('maths') },
                "SSC_GK_Notion_Import.csv": { "content": getSubjectCSV('gk') },
                "SSC_Reasoning_Notion_Import.csv": { "content": getSubjectCSV('reasoning') },
                "SSC_English_Notion_Import.csv": { "content": getSubjectCSV('english') }
            }
        };

        const result = await githubRequest('POST', '/gists', body);
        gistId = result.id;

        localStorage.setItem('ssc_maths_github_token', githubToken);
        localStorage.setItem('ssc_maths_gist_id', gistId);
        document.getElementById('cloud-gist-id').value = gistId;

        updateSyncStatus('synced');
        updateSyncControls();
        showToast("Cloud Gist initialized with all subjects!");
    } catch (err) {
        console.error(err);
        githubToken = localStorage.getItem('ssc_maths_github_token') || '';
        updateSyncStatus('error');
        showToast("Gist creation failed: " + err.message, "warning");
    }
}

// Link an existing Gist ID
async function linkCloudGist() {
    const inputToken = document.getElementById('cloud-token').value.trim();
    const inputGistId = document.getElementById('cloud-gist-id').value.trim();

    if (!inputToken || !inputGistId) {
        showToast("Token and Gist ID are both required!", "warning");
        return;
    }

    githubToken = inputToken;
    gistId = inputGistId;
    updateSyncStatus('syncing');

    try {
        const result = await githubRequest('GET', `/gists/${gistId}`);
        const hasAnyFile = result.files["SSC_Maths_Notion_Import.csv"] ||
            result.files["SSC_GK_Notion_Import.csv"] ||
            result.files["SSC_Reasoning_Notion_Import.csv"] ||
            result.files["SSC_English_Notion_Import.csv"];

        if (!hasAnyFile) {
            if (confirm("Linked Gist found, but it doesn't contain tracker files. Initialize and upload current local progress?")) {
                localStorage.setItem('ssc_maths_github_token', githubToken);
                localStorage.setItem('ssc_maths_gist_id', gistId);
                updateSyncControls();
                await pushToCloud(false);
            } else {
                githubToken = localStorage.getItem('ssc_maths_github_token') || '';
                gistId = localStorage.getItem('ssc_maths_gist_id') || '';
                updateSyncStatus('local');
            }
            return;
        }

        localStorage.setItem('ssc_maths_github_token', githubToken);
        localStorage.setItem('ssc_maths_gist_id', gistId);
        updateSyncStatus('synced');
        updateSyncControls();
        showToast("Cloud Gist linked successfully!");
    } catch (err) {
        console.error(err);
        githubToken = localStorage.getItem('ssc_maths_github_token') || '';
        gistId = localStorage.getItem('ssc_maths_gist_id') || '';
        updateSyncStatus('error');
        showToast("Linking failed: " + err.message, "warning");
    }
}

// Pull latest data from Cloud (Gist -> local) for all subjects
async function pullFromCloud() {
    if (!gistId || !githubToken) return;
    updateSyncStatus('syncing');
    try {
        const result = await githubRequest('GET', `/gists/${gistId}`);

        const pullSubject = (subject, filename) => {
            const file = result.files[filename];
            if (!file) return;

            const csvContent = file.content;
            const parsed = parseCSV(csvContent);
            if (parsed.length <= 1) return;

            const headers = parsed[0].map(h => h.trim().toLowerCase());
            const lectureIdx = headers.indexOf("lecture");
            const phaseIdx = headers.indexOf("phase");
            const topicIdx = headers.indexOf("topic");
            const classNoIdx = headers.indexOf("class no");
            const completedIdx = headers.indexOf("completed");
            const notesMakingIdx = headers.indexOf("notes making");
            const rev1Idx = headers.indexOf("revision 1");
            const rev2Idx = headers.indexOf("revision 2");
            const questionsIdx = headers.indexOf("questions solved");
            const weakIdx = headers.indexOf("weak topic");
            const dateIdx = headers.indexOf("date completed");
            const notesIdx = headers.indexOf("notes");

            const parsedLectures = parsed.slice(1)
                .filter(row => row.length >= 4 && row[lectureIdx].trim() !== "")
                .map((row, idx) => {
                    return {
                        id: idx,
                        lecture: row[lectureIdx],
                        phase: row[phaseIdx],
                        topic: row[topicIdx],
                        classNo: classNoIdx !== -1 ? parseInt(row[classNoIdx]) || 0 : 0,
                        completed: completedIdx !== -1 ? (row[completedIdx] === 'True' || row[completedIdx] === 'true' || row[completedIdx] === '1') : false,
                        notesMaking: notesMakingIdx !== -1 ? (row[notesMakingIdx] === 'True' || row[notesMakingIdx] === 'true' || row[notesMakingIdx] === '1') : false,
                        revision1: rev1Idx !== -1 ? (row[rev1Idx] === 'True' || row[rev1Idx] === 'true' || row[rev1Idx] === '1') : false,
                        revision2: rev2Idx !== -1 ? (row[rev2Idx] === 'True' || row[rev2Idx] === 'true' || row[rev2Idx] === '1') : false,
                        questionsSolved: (questionsIdx !== -1 && row[questionsIdx]) ? parseInt(row[questionsIdx]) || 0 : 0,
                        weakTopic: weakIdx !== -1 ? (row[weakIdx] === 'True' || row[weakIdx] === 'true' || row[weakIdx] === '1') : false,
                        dateCompleted: dateIdx !== -1 ? row[dateIdx] : "",
                        notes: notesIdx !== -1 ? row[notesIdx] : ""
                    };
                });

            localStorage.setItem(`ssc_${subject}_progress`, JSON.stringify(parsedLectures));
            if (subject === currentSubject) {
                lectures = parsedLectures;
            }
        };

        pullSubject('maths', 'SSC_Maths_Notion_Import.csv');
        pullSubject('gk', 'SSC_GK_Notion_Import.csv');
        pullSubject('reasoning', 'SSC_Reasoning_Notion_Import.csv');
        pullSubject('english', 'SSC_English_Notion_Import.csv');

        populatePhaseTabs();
        populateTopicFilter();
        updateDashboard();
        renderLectures();
        updateSyncStatus('synced');
        showToast("All subjects pulled from Cloud!");
    } catch (err) {
        console.error(err);
        updateSyncStatus('error');
        showToast("Pull failed: " + err.message, "warning");
    }
}

// Push local data to Cloud (local -> Gist) for all subjects
async function pushToCloud(isAuto = false) {
    if (!gistId || !githubToken) return;
    updateSyncStatus('syncing');
    try {
        const getSubjectCSV = (subject) => {
            if (subject === currentSubject) {
                return stateToCSV(lectures);
            }
            const saved = localStorage.getItem(`ssc_${subject}_progress`);
            if (saved) {
                try {
                    return stateToCSV(JSON.parse(saved));
                } catch (e) { }
            }

            let rawData = '';
            if (subject === 'maths') rawData = typeof defaultCsvData !== 'undefined' ? defaultCsvData : '';
            else if (subject === 'gk') rawData = typeof defaultGkCsv !== 'undefined' ? defaultGkCsv : '';
            else if (subject === 'reasoning') rawData = typeof defaultReasoningCsv !== 'undefined' ? defaultReasoningCsv : '';
            else if (subject === 'english') rawData = typeof defaultEnglishCsv !== 'undefined' ? defaultEnglishCsv : '';

            const parsed = parseCSV(rawData);
            const dummy = parsed.slice(1).map((row, idx) => ({
                lecture: row[0], phase: row[1], topic: row[2], classNo: parseInt(row[3]) || 0,
                completed: false, notesMaking: false, revision1: false, revision2: false, questionsSolved: 0,
                weakTopic: false, dateCompleted: "", notes: ""
            }));
            return stateToCSV(dummy);
        };

        const body = {
            files: {
                "SSC_Maths_Notion_Import.csv": { "content": getSubjectCSV('maths') },
                "SSC_GK_Notion_Import.csv": { "content": getSubjectCSV('gk') },
                "SSC_Reasoning_Notion_Import.csv": { "content": getSubjectCSV('reasoning') },
                "SSC_English_Notion_Import.csv": { "content": getSubjectCSV('english') }
            }
        };

        await githubRequest('PATCH', `/gists/${gistId}`, body);
        updateSyncStatus('synced');
        if (!isAuto) showToast("All progress synced to Cloud Gist!");
    } catch (err) {
        console.error(err);
        updateSyncStatus('error');
        if (!isAuto) showToast("Auto-sync failed: " + err.message, "warning");
    }
}

// Debounced background upload trigger
function triggerAutoSync() {
    if (!gistId || !githubToken) return;
    updateSyncStatus('syncing');
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
        pushToCloud(true);
    }, 2000);
}

// Save Settings form changes
function saveCloudSettings() {
    const inputToken = document.getElementById('cloud-token').value.trim();
    const inputGistId = document.getElementById('cloud-gist-id').value.trim();

    if (inputToken !== githubToken || inputGistId !== gistId) {
        githubToken = inputToken;
        gistId = inputGistId;

        if (githubToken) {
            localStorage.setItem('ssc_maths_github_token', githubToken);
        } else {
            localStorage.removeItem('ssc_maths_github_token');
        }

        if (gistId) {
            localStorage.setItem('ssc_maths_gist_id', gistId);
        } else {
            localStorage.removeItem('ssc_maths_gist_id');
        }

        loadCloudSettingsState();
        showToast("Cloud configuration saved!");
    }
    closeCloudDrawer();
}

// Disconnect Gist Cloud link entirely
function disconnectCloud() {
    if (confirm("Disconnect Cloud Sync? Your progress will remain saved locally on this browser but will not sync to GitHub.")) {
        localStorage.removeItem('ssc_maths_github_token');
        localStorage.removeItem('ssc_maths_gist_id');
        githubToken = '';
        gistId = '';

        document.getElementById('cloud-token').value = '';
        document.getElementById('cloud-gist-id').value = '';

        updateSyncStatus('local');
        updateSyncControls();
        closeCloudDrawer();
        showToast("Cloud sync disconnected.");
    }
}
