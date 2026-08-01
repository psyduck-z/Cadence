const timetableStorageKey = "cadence-school-timetable";
const timetablePatternKey = "cadence-timetable-pattern";
const timetableAnchorKey = "cadence-timetable-ab-anchor";
const timetableWeekTabs = document.getElementById("timetableWeekTabs");
const timetableGrid = document.getElementById("timetableGrid");
const addAlternateWeekButton = document.getElementById("addAlternateWeek");
const clearWeekButton = document.getElementById("clearTimetableWeek");
const addEventButton = document.getElementById("addTimetableEvent");
const eventForm = document.getElementById("timetableEventForm");
const cancelEventButton = document.getElementById("cancelTimetableEvent");
const deleteEventButton = document.getElementById("deleteTimetableEvent");
const timetableFormError = document.getElementById("timetableFormError");
const clearWeekModal = document.getElementById("clearWeekModal");
const clearWeekModalTitle = document.getElementById("clearWeekModalTitle");
const clearWeekModalMessage = document.getElementById("clearWeekModalMessage");
const cancelClearWeekButton = document.getElementById("cancelClearWeek");
const confirmClearWeekButton = document.getElementById("confirmClearWeek");
const removeWeekBModal = document.getElementById("removeWeekBModal");
const removeWeekBModalMessage = document.getElementById("removeWeekBModalMessage");
const cancelRemoveWeekBButton = document.getElementById("cancelRemoveWeekB");
const confirmRemoveWeekBButton = document.getElementById("confirmRemoveWeekB");
const schoolDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const hourHeight = 54;

let timetableEvents = [];
let hasAlternateWeek = localStorage.getItem(timetablePatternKey) === "AB";
let selectedTimetableWeek = "A";

function loadTimetableEvents() {
    try {
        const saved = JSON.parse(localStorage.getItem(timetableStorageKey) || "[]");
        timetableEvents = Array.isArray(saved) ? saved : [];
    } catch {
        timetableEvents = [];
    }
}

function saveTimetableEvents() {
    localStorage.setItem(timetableStorageKey, JSON.stringify(timetableEvents));
    syncTimetableReminders();
}

function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function currentMondayKey() {
    const date = new Date();
    const offset = (date.getDay() + 6) % 7;
    date.setDate(date.getDate() - offset);
    return localDateKey(date);
}

function syncTimetableReminders() {
    try {
        const { ipcRenderer } = require("electron");
        ipcRenderer.send("sync-timetable-reminders", {
            events: timetableEvents,
            hasAlternateWeek,
            anchorMonday: localStorage.getItem(timetableAnchorKey) || currentMondayKey()
        });
    } catch {
        // The timetable remains usable outside Electron.
    }
}

function minutesFromTime(time) {
    const [hours, minutes] = time.split(":").map(Number);
    return (hours * 60) + minutes;
}

function renderTimetableWeekTabs() {
    timetableWeekTabs.replaceChildren();
    const weeks = hasAlternateWeek ? ["A", "B"] : ["A"];
    weeks.forEach(week => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = `Week ${week}`;
        button.setAttribute("role", "tab");
        button.setAttribute("aria-selected", String(week === selectedTimetableWeek));
        if (week === selectedTimetableWeek) button.classList.add("active");
        button.addEventListener("click", () => {
            selectedTimetableWeek = week;
            closeEventForm();
            renderTimetable();
        });
        timetableWeekTabs.append(button);
    });
}

function makeEventBlock(event) {
    const block = document.createElement("button");
    const name = document.createElement("strong");
    const time = document.createElement("span");
    const start = minutesFromTime(event.start);
    const duration = minutesFromTime(event.end) - start;
    block.type = "button";
    block.className = `timetable-event color-${event.color || "mint"}`;
    block.style.top = `${(start / 60) * hourHeight}px`;
    block.style.height = `${Math.max((duration / 60) * hourHeight, 18)}px`;
    block.title = `Edit ${event.name}`;
    name.textContent = event.name;
    time.textContent =
        `${event.start}–${event.end}${event.reminder ? " · 🔔" : ""}`;
    block.append(name, time);
    block.addEventListener("click", () => openEventForm(event));
    return block;
}

function renderGrid() {
    const previousTop = timetableGrid.scrollTop;
    const previousLeft = timetableGrid.scrollLeft;
    const grid = document.createElement("div");
    const corner = document.createElement("div");
    grid.className = "timetable-grid";
    corner.className = "timetable-corner";
    grid.append(corner);

    schoolDays.forEach(day => {
        const heading = document.createElement("div");
        heading.className = "timetable-day-heading";
        heading.textContent = day;
        grid.append(heading);
    });

    const timeColumn = document.createElement("div");
    timeColumn.className = "timetable-time-column";
    for (let hour = 0; hour < 24; hour++) {
        const label = document.createElement("span");
        label.style.top = `${hour * hourHeight}px`;
        label.textContent = `${String(hour).padStart(2, "0")}:00`;
        timeColumn.append(label);
    }
    grid.append(timeColumn);

    schoolDays.forEach((day, dayIndex) => {
        const column = document.createElement("div");
        column.className = "timetable-day-column";
        column.dataset.day = dayIndex;
        for (let hour = 0; hour < 24; hour++) {
            const line = document.createElement("i");
            line.style.top = `${hour * hourHeight}px`;
            column.append(line);
        }
        timetableEvents
            .filter(event => event.week === selectedTimetableWeek && event.day === dayIndex)
            .forEach(event => column.append(makeEventBlock(event)));
        grid.append(column);
    });

    timetableGrid.replaceChildren(grid);
    timetableGrid.scrollTop = previousTop || (6 * hourHeight);
    timetableGrid.scrollLeft = previousLeft;
}

function renderTimetable() {
    renderTimetableWeekTabs();
    renderGrid();
    addAlternateWeekButton.innerHTML = hasAlternateWeek
        ? "<span>✓</span> Week B"
        : "<span>+</span> Week B";
    addAlternateWeekButton.classList.toggle("is-enabled", hasAlternateWeek);
    addAlternateWeekButton.title = hasAlternateWeek
        ? "Remove Week B and all of its events"
        : "Add a different Week B schedule";
    clearWeekButton.textContent = `Clear ${selectedTimetableWeek}`;
    clearWeekButton.title = `Clear all events from Week ${selectedTimetableWeek}`;
}

function openEventForm(event = null) {
    eventForm.reset();
    timetableFormError.textContent = "";
    document.getElementById("timetableEventId").value = event?.id || "";
    document.getElementById("timetableEventName").value = event?.name || "";
    document.getElementById("timetableEventDay").value = String(event?.day ?? 0);
    document.getElementById("timetableEventColor").value = event?.color || "mint";
    document.getElementById("timetableEventStart").value = event?.start || "06:00";
    document.getElementById("timetableEventEnd").value = event?.end || "08:00";
    document.getElementById("timetableEventReminder").checked = Boolean(event?.reminder);
    deleteEventButton.classList.toggle("hidden", !event);
    eventForm.classList.remove("hidden");
    addEventButton.classList.add("hidden");
    document.getElementById("timetableEventName").focus();
}

function closeEventForm() {
    eventForm.classList.add("hidden");
    addEventButton.classList.remove("hidden");
    timetableFormError.textContent = "";
}

addAlternateWeekButton.addEventListener("click", () => {
    if (!hasAlternateWeek) {
        hasAlternateWeek = true;
        selectedTimetableWeek = "B";
        localStorage.setItem(timetablePatternKey, "AB");
        localStorage.setItem(timetableAnchorKey, currentMondayKey());
        syncTimetableReminders();
        renderTimetable();
        return;
    }
    const weekBEvents = timetableEvents.filter(event => event.week === "B");
    removeWeekBModalMessage.textContent = weekBEvents.length
        ? `${weekBEvents.length} ${weekBEvents.length === 1 ? "event" : "events"} in Week B will be permanently removed.`
        : "Week B will be removed. It does not have any events yet.";
    removeWeekBModal.classList.remove("hidden");
    cancelRemoveWeekBButton.focus();
});

function closeRemoveWeekBModal() {
    removeWeekBModal.classList.add("hidden");
}

cancelRemoveWeekBButton.addEventListener("click", closeRemoveWeekBModal);

removeWeekBModal.addEventListener("click", event => {
    if (event.target === removeWeekBModal) closeRemoveWeekBModal();
});

confirmRemoveWeekBButton.addEventListener("click", () => {
    timetableEvents = timetableEvents.filter(event => event.week !== "B");
    hasAlternateWeek = false;
    selectedTimetableWeek = "A";
    localStorage.removeItem(timetablePatternKey);
    localStorage.removeItem(timetableAnchorKey);
    saveTimetableEvents();
    closeRemoveWeekBModal();
    closeEventForm();
    renderTimetable();
});

clearWeekButton.addEventListener("click", () => {
    const weekEvents = timetableEvents.filter(event => event.week === selectedTimetableWeek);
    if (!weekEvents.length) return;
    clearWeekModalTitle.textContent = `Clear Week ${selectedTimetableWeek}?`;
    clearWeekModalMessage.textContent =
        `${weekEvents.length} ${weekEvents.length === 1 ? "event" : "events"} will be removed from this week.`;
    confirmClearWeekButton.textContent = `Clear Week ${selectedTimetableWeek}`;
    clearWeekModal.dataset.week = selectedTimetableWeek;
    clearWeekModal.classList.remove("hidden");
    cancelClearWeekButton.focus();
});

cancelClearWeekButton.addEventListener("click", () => {
    clearWeekModal.classList.add("hidden");
});

clearWeekModal.addEventListener("click", event => {
    if (event.target === clearWeekModal) {
        clearWeekModal.classList.add("hidden");
    }
});

confirmClearWeekButton.addEventListener("click", () => {
    const week = clearWeekModal.dataset.week;
    if (!week) return;
    timetableEvents = timetableEvents.filter(event => event.week !== week);
    saveTimetableEvents();
    clearWeekModal.classList.add("hidden");
    delete clearWeekModal.dataset.week;
    closeEventForm();
    renderTimetable();
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !clearWeekModal.classList.contains("hidden")) {
        clearWeekModal.classList.add("hidden");
    }
    if (event.key === "Escape" && !removeWeekBModal.classList.contains("hidden")) {
        closeRemoveWeekBModal();
    }
});

addEventButton.addEventListener("click", () => openEventForm());
cancelEventButton.addEventListener("click", closeEventForm);
deleteEventButton.addEventListener("click", () => {
    const id = document.getElementById("timetableEventId").value;
    timetableEvents = timetableEvents.filter(event => event.id !== id);
    saveTimetableEvents();
    closeEventForm();
    renderTimetable();
});

eventForm.addEventListener("submit", event => {
    event.preventDefault();
    const start = document.getElementById("timetableEventStart").value;
    const end = document.getElementById("timetableEventEnd").value;
    if (minutesFromTime(end) <= minutesFromTime(start)) {
        timetableFormError.textContent = "The ending time must be after the starting time.";
        return;
    }
    const id = document.getElementById("timetableEventId").value;
    const item = {
        id: id || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
        week: selectedTimetableWeek,
        name: document.getElementById("timetableEventName").value.trim(),
        day: Number(document.getElementById("timetableEventDay").value),
        color: document.getElementById("timetableEventColor").value,
        start,
        end,
        reminder: document.getElementById("timetableEventReminder").checked
    };
    timetableEvents = id
        ? timetableEvents.map(existing => existing.id === id ? item : existing)
        : [...timetableEvents, item];
    saveTimetableEvents();
    closeEventForm();
    renderTimetable();
});

loadTimetableEvents();
renderTimetable();
syncTimetableReminders();
