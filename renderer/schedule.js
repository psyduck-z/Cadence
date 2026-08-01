const activityStorageKey = "cadence-weekly-activities";
const activityForm = document.getElementById("activityForm");
const daySchedule = document.getElementById("daySchedule");
const dayTabs = document.getElementById("scheduleDayTabs");
const nextActivityDisplay = document.getElementById("nextActivity");
const selectedDayLabel = document.getElementById("selectedDayLabel");
const selectedDayHeading = document.getElementById("selectedDayHeading");
const newActivityButton = document.getElementById("newActivityButton");
const cancelActivityButton = document.getElementById("cancelActivityButton");
const activityFormError = document.getElementById("activityFormError");
const reminderCheckbox = document.getElementById("activityReminder");
const reminderTimeLabel = document.getElementById("reminderTimeLabel");
const reminderTimeInput = document.getElementById("activityTime");

let activities = [];
let selectedDate = dateKey(new Date());

function startOfDay(date) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}

function addDays(date, amount) {
    const result = new Date(date);
    result.setDate(result.getDate() + amount);
    return result;
}

function dateKey(date) {
    const local = new Date(date);
    return `${local.getFullYear()}-${String(local.getMonth() + 1).padStart(2, "0")}-${String(local.getDate()).padStart(2, "0")}`;
}

function dateFromKey(key) {
    const [year, month, day] = key.split("-").map(Number);
    return new Date(year, month - 1, day);
}

function nextDateForWeekday(day) {
    const today = startOfDay(new Date());
    const offset = (Number(day) - today.getDay() + 7) % 7;
    return dateKey(addDays(today, offset));
}

function visibleWeeks() {
    const today = startOfDay(new Date());
    const daysUntilSunday = (7 - today.getDay()) % 7;
    const current = Array.from(
        { length: daysUntilSunday + 1 },
        (_, index) => addDays(today, index)
    );
    const nextMonday = addDays(today, daysUntilSunday + 1);
    const next = Array.from({ length: 7 }, (_, index) => addDays(nextMonday, index));
    return [current, next];
}

function saveActivities() {
    localStorage.setItem(activityStorageKey, JSON.stringify(activities));
    syncRemindersWithBackground();
}

function syncRemindersWithBackground() {
    try {
        const { ipcRenderer } = require("electron");
        ipcRenderer.send("sync-schedule-reminders", activities);
    } catch {
        // The browser fallback still keeps the schedule usable.
    }
}

function loadActivities() {
    try {
        const saved = JSON.parse(localStorage.getItem(activityStorageKey) || "[]");
        activities = Array.isArray(saved) ? saved.map(item => ({
            id: item.id || `${Date.now()}-${Math.random()}`,
            name: item.name || "Untitled reminder",
            date: item.date || nextDateForWeekday(item.day),
            notes: item.notes || "",
            priority: ["high", "medium", "low"].includes(item.priority)
                ? item.priority
                : "medium",
            reminder: Boolean(item.reminder),
            time: item.time || item.start || "",
            completed: Boolean(item.completed),
            lastReminder: item.lastReminder || ""
        })) : [];
        saveActivities();
    } catch {
        activities = [];
    }
}

function formatTime(time) {
    if (!time) return "";
    const [hours, minutes] = time.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function selectedDayActivities() {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return activities
        .filter(activity => activity.date === selectedDate)
        .sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            if (a.priority !== b.priority) {
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            }
            if (a.reminder !== b.reminder) return a.reminder ? -1 : 1;
            return (a.time || "99:99").localeCompare(b.time || "99:99");
        });
}

function renderDayTabs() {
    dayTabs.replaceChildren();
    const todayKey = dateKey(new Date());

    visibleWeeks().forEach((dates, weekIndex) => {
        const row = document.createElement("div");
        const label = document.createElement("span");
        row.className = "schedule-week-row";
        label.className = "schedule-week-label";
        label.textContent = weekIndex ? "Next week" : "This week";
        row.append(label);

        dates.forEach(date => {
            const key = dateKey(date);
            const button = document.createElement("button");
            const weekday = document.createElement("span");
            const number = document.createElement("b");
            const dot = document.createElement("i");
            button.type = "button";
            button.className = "schedule-day-tab";
            button.setAttribute("role", "tab");
            button.setAttribute("aria-label", date.toLocaleDateString([], {
                weekday: "long", month: "long", day: "numeric"
            }));
            button.setAttribute("aria-selected", String(key === selectedDate));
            if (key === selectedDate) button.classList.add("active");
            if (key === todayKey) button.classList.add("is-today");
            if (activities.some(activity => activity.date === key)) button.classList.add("has-items");
            weekday.textContent = date.toLocaleDateString([], { weekday: "narrow" });
            number.textContent = date.getDate();
            dot.setAttribute("aria-hidden", "true");
            button.append(weekday, number, dot);
            button.addEventListener("click", () => {
                selectedDate = key;
                closeActivityForm();
                render();
            });
            row.append(button);
        });
        dayTabs.append(row);
    });
}

function makeButton(label, title, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.title = title;
    button.addEventListener("click", onClick);
    return button;
}

function renderActivity(activity) {
    const card = document.createElement("article");
    const completion = document.createElement("input");
    const content = document.createElement("div");
    const heading = document.createElement("div");
    const name = document.createElement("strong");
    const priority = document.createElement("span");
    const time = document.createElement("span");
    const actions = document.createElement("div");
    card.className = "activity-card" + (activity.completed ? " is-completed" : "");
    completion.type = "checkbox";
    completion.className = "activity-completion";
    completion.checked = activity.completed;
    completion.setAttribute("aria-label", `Mark ${activity.name} as complete`);
    completion.addEventListener("change", () => {
        activity.completed = completion.checked;
        saveActivities();
        render();
    });
    content.className = "activity-content";
    heading.className = "activity-heading";
    name.textContent = activity.name;
    priority.className = `activity-priority priority-${activity.priority}`;
    priority.textContent = activity.priority;
    time.className = "activity-time";
    time.textContent = activity.reminder && activity.time ? formatTime(activity.time) : "Anytime";
    heading.append(name, priority, time);
    content.append(heading);
    if (activity.notes) {
        const notes = document.createElement("p");
        notes.className = "activity-notes";
        notes.textContent = activity.notes;
        content.append(notes);
    }
    actions.className = "activity-actions";
    actions.append(
        makeButton("Edit", `Edit ${activity.name}`, () => openActivityForm(activity)),
        makeButton("×", `Delete ${activity.name}`, () => {
            activities = activities.filter(item => item.id !== activity.id);
            saveActivities();
            render();
        })
    );
    card.append(completion, content, actions);
    return card;
}

function renderDay() {
    const date = dateFromKey(selectedDate);
    const items = selectedDayActivities();
    const remaining = items.filter(item => !item.completed).length;
    selectedDayHeading.textContent = date.toLocaleDateString([], { weekday: "long" });
    selectedDayLabel.textContent = selectedDate === dateKey(new Date())
        ? "Today"
        : date.toLocaleDateString([], { month: "short", day: "numeric" });
    nextActivityDisplay.textContent = items.length
        ? remaining
            ? `${remaining} ${remaining === 1 ? "thing" : "things"} to remember`
            : "Everything is checked off"
        : "A clear day ahead";
    daySchedule.replaceChildren();
    if (!items.length) {
        const empty = document.createElement("div");
        empty.className = "schedule-empty";
        empty.innerHTML = "<span>☕</span><p>Nothing to remember yet</p><small>Add a gentle nudge or leave the day open.</small>";
        daySchedule.append(empty);
        return;
    }
    items.forEach(activity => daySchedule.append(renderActivity(activity)));
}

function render() {
    const visibleKeys = visibleWeeks().flat().map(dateKey);
    if (!visibleKeys.includes(selectedDate)) selectedDate = visibleKeys[0];
    renderDayTabs();
    renderDay();
}

function defaultReminderTime() {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function updateReminderField() {
    reminderTimeLabel.classList.toggle("hidden", !reminderCheckbox.checked);
    reminderTimeInput.required = reminderCheckbox.checked;
}

function openActivityForm(activity = null) {
    activityForm.reset();
    activityFormError.textContent = "";
    document.getElementById("activityId").value = activity?.id || "";
    document.getElementById("activityName").value = activity?.name || "";
    document.getElementById("activityNotes").value = activity?.notes || "";
    document.getElementById("activityPriority").value = activity?.priority || "medium";
    reminderCheckbox.checked = activity?.reminder || false;
    reminderTimeInput.value = activity?.time || defaultReminderTime();
    updateReminderField();
    activityForm.classList.remove("hidden");
    newActivityButton.classList.add("hidden");
    document.getElementById("activityName").focus();
}

function closeActivityForm() {
    activityForm.classList.add("hidden");
    newActivityButton.classList.remove("hidden");
    activityFormError.textContent = "";
}

newActivityButton.addEventListener("click", () => openActivityForm());
cancelActivityButton.addEventListener("click", closeActivityForm);
reminderCheckbox.addEventListener("change", updateReminderField);

activityForm.addEventListener("submit", event => {
    event.preventDefault();
    const id = document.getElementById("activityId").value;
    const existing = activities.find(activity => activity.id === id);
    const activity = {
        id: id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        name: document.getElementById("activityName").value.trim(),
        date: selectedDate,
        notes: document.getElementById("activityNotes").value.trim(),
        priority: document.getElementById("activityPriority").value,
        reminder: reminderCheckbox.checked,
        time: reminderCheckbox.checked ? reminderTimeInput.value : "",
        completed: existing?.completed || false,
        lastReminder: existing?.lastReminder || ""
    };
    if (!activity.name) {
        activityFormError.textContent = "Add something you want to remember.";
        return;
    }
    activities = existing
        ? activities.map(item => item.id === id ? activity : item)
        : [...activities, activity];
    saveActivities();
    closeActivityForm();
    render();
});

loadActivities();
render();
syncRemindersWithBackground();
