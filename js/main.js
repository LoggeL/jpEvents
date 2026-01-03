/**
 * JP Events - Clean ICS Parser & Event Display
 */

dayjs.extend(dayjs_plugin_relativeTime)

// ============================================================
// Configuration
// ============================================================
const CALENDAR_URL = 'https://nextcloud.jupeters.de/remote.php/dav/public-calendars/2MTfKNgsWXQZ7MDN?export'
const CORS_PROXY = 'https://calendar.logge.workers.dev/'
const MAX_PAST_EVENTS_AGE_YEARS = 1

// ============================================================
// ICS Parser
// ============================================================
class ICSParser {
    /**
     * Parse an ICS string into an array of event objects
     * @param {string} icsString - Raw ICS calendar data
     * @returns {Array} Array of parsed event objects
     */
    static parse(icsString) {
        const lines = this.unfoldLines(icsString)
        const events = []
        let currentEvent = null

        for (const line of lines) {
            if (line === 'BEGIN:VEVENT') {
                currentEvent = {}
                continue
            }

            if (line === 'END:VEVENT') {
                if (currentEvent && Object.keys(currentEvent).length > 0) {
                    events.push(this.processEvent(currentEvent))
                }
                currentEvent = null
                continue
            }

            if (currentEvent === null) continue

            const parsed = this.parseLine(line)
            if (parsed) {
                currentEvent[parsed.property] = {
                    value: parsed.value,
                    params: parsed.params
                }
            }
        }

        return events
    }

    /**
     * Unfold ICS lines (RFC 5545: lines starting with space/tab are continuations)
     * @param {string} icsString - Raw ICS string
     * @returns {Array} Array of unfolded lines
     */
    static unfoldLines(icsString) {
        // Normalize line endings to \n
        const normalized = icsString.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
        
        // Unfold continuation lines (lines starting with space or tab)
        const unfolded = normalized.replace(/\n[ \t]/g, '')
        
        return unfolded.split('\n').filter(line => line.trim().length > 0)
    }

    /**
     * Parse a single ICS property line
     * @param {string} line - A single ICS line
     * @returns {Object|null} Parsed property object or null
     */
    static parseLine(line) {
        const colonIndex = line.indexOf(':')
        if (colonIndex === -1) return null

        const propertyPart = line.substring(0, colonIndex)
        const valuePart = line.substring(colonIndex + 1)

        // Parse property name and parameters (e.g., "DTSTART;TZID=Europe/Berlin")
        const parts = propertyPart.split(';')
        const property = parts[0].toUpperCase()
        
        // Parse parameters
        const params = {}
        for (let i = 1; i < parts.length; i++) {
            const eqIndex = parts[i].indexOf('=')
            if (eqIndex !== -1) {
                const paramName = parts[i].substring(0, eqIndex).toUpperCase()
                const paramValue = parts[i].substring(eqIndex + 1)
                params[paramName] = paramValue
            }
        }

        // Unescape value
        const value = this.unescapeValue(valuePart)

        return { property, value, params }
    }

    /**
     * Unescape ICS special characters
     * @param {string} value - Escaped value
     * @returns {string} Unescaped value
     */
    static unescapeValue(value) {
        return value
            .replace(/\\n/gi, '\n')
            .replace(/\\,/g, ',')
            .replace(/\\;/g, ';')
            .replace(/\\\\/g, '\\')
    }

    /**
     * Parse ICS date/datetime value
     * @param {string} value - Date string (YYYYMMDD or YYYYMMDDTHHmmss)
     * @param {Object} params - Property parameters
     * @returns {Object} { date: dayjs, isAllDay: boolean }
     */
    static parseDate(value, params = {}) {
        const isAllDay = params.VALUE === 'DATE' || /^\d{8}$/.test(value)
        
        let date
        if (isAllDay) {
            // Date only: YYYYMMDD
            date = dayjs(value, 'YYYYMMDD')
        } else {
            // DateTime: YYYYMMDDTHHmmss or YYYYMMDDTHHmmssZ
            const cleanValue = value.replace('Z', '')
            date = dayjs(cleanValue, 'YYYYMMDDTHHmmss')
        }

        return { date, isAllDay }
    }

    /**
     * Process raw event data into a clean event object
     * @param {Object} rawEvent - Raw parsed event
     * @returns {Object} Processed event object
     */
    static processEvent(rawEvent) {
        const event = {
            uid: rawEvent.UID?.value || null,
            title: rawEvent.SUMMARY?.value || 'Untitled Event',
            description: rawEvent.DESCRIPTION?.value || null,
            location: rawEvent.LOCATION?.value || null,
            status: rawEvent.STATUS?.value || null,
            url: null,
            start: null,
            end: null,
            isAllDay: false,
            startTimestamp: null,
            endTimestamp: null
        }

        // Parse start date
        if (rawEvent.DTSTART) {
            const { date, isAllDay } = this.parseDate(
                rawEvent.DTSTART.value,
                rawEvent.DTSTART.params
            )
            if (date.isValid()) {
                event.start = date
                event.startTimestamp = date.valueOf()
                event.isAllDay = isAllDay
            }
        }

        // Parse end date
        if (rawEvent.DTEND) {
            const { date, isAllDay } = this.parseDate(
                rawEvent.DTEND.value,
                rawEvent.DTEND.params
            )
            if (date.isValid()) {
                // For all-day events, DTEND is exclusive (next day), so subtract 1 day for display
                event.end = isAllDay ? date.subtract(1, 'day') : date
                event.endTimestamp = date.valueOf()
            }
        }

        // If no end date, use start date
        if (!event.end && event.start) {
            event.end = event.start
            event.endTimestamp = event.startTimestamp
        }

        // Extract URL from description if present
        if (event.description) {
            const urlMatch = event.description.match(/https?:\/\/[^\s<>"]+/)
            if (urlMatch) {
                try {
                    event.url = new URL(urlMatch[0]).href
                } catch (e) {
                    // Invalid URL, ignore
                }
            }
        }

        // Also check for URL property
        if (rawEvent.URL?.value) {
            event.url = rawEvent.URL.value
        }

        return event
    }
}

// ============================================================
// Event Renderer
// ============================================================
class EventRenderer {
    constructor(upcomingContainer, pastContainer, template) {
        this.upcomingContainer = upcomingContainer
        this.pastContainer = pastContainer
        this.template = template
    }

    /**
     * Render all events
     * @param {Array} events - Array of processed events
     */
    render(events) {
        // Clear loading states
        this.upcomingContainer.innerHTML = ''
        this.pastContainer.innerHTML = ''

        // Sort by start date
        events.sort((a, b) => a.startTimestamp - b.startTimestamp)

        // Filter out very old events
        const cutoffDate = dayjs().subtract(MAX_PAST_EVENTS_AGE_YEARS, 'year')
        const relevantEvents = events.filter(e => 
            e.end && e.end.isAfter(cutoffDate)
        )

        const now = Date.now()
        const upcomingEvents = relevantEvents.filter(e => e.endTimestamp >= now)
        const pastEvents = relevantEvents.filter(e => e.endTimestamp < now)

        // Update section visibility
        this.updateSectionVisibility('upcoming', upcomingEvents.length)
        this.updateSectionVisibility('past', pastEvents.length)

        // Render upcoming events (chronological order)
        upcomingEvents.forEach(event => {
            const card = this.createEventCard(event, false)
            this.upcomingContainer.appendChild(card)
        })

        // Render past events (reverse chronological - most recent first)
        pastEvents.reverse().forEach(event => {
            const card = this.createEventCard(event, true)
            this.pastContainer.appendChild(card)
        })
    }

    /**
     * Update section visibility based on event count
     */
    updateSectionVisibility(section, count) {
        const container = section === 'upcoming' ? this.upcomingContainer : this.pastContainer
        const header = container.previousElementSibling
        
        if (count === 0 && header) {
            header.style.display = 'none'
        }
    }

    /**
     * Create an event card element
     * @param {Object} event - Event object
     * @param {boolean} isPast - Whether this is a past event
     * @returns {HTMLElement} Card element
     */
    createEventCard(event, isPast) {
        const card = this.template.cloneNode(true)
        card.style.display = 'block'
        card.id = ''

        const body = card.querySelector('.card-body')
        const title = body.querySelector('.card-title')
        const subtitle = body.querySelector('.card-subtitle')
        const text = body.querySelector('.card-text')
        const link = body.querySelector('a')

        // Title with location
        let titleText = event.title
        if (event.location) {
            titleText += ` 📍 ${event.location}`
        }
        title.textContent = titleText

        // Relative time
        if (isPast) {
            subtitle.textContent = event.end.fromNow()
        } else {
            subtitle.textContent = event.start.fromNow()
        }

        // Date range
        text.textContent = this.formatDateRange(event)

        // Link button
        if (event.url) {
            link.href = event.url
            link.style.display = 'inline-block'
        } else {
            link.style.display = 'none'
        }

        return card
    }

    /**
     * Format event date range for display
     * @param {Object} event - Event object
     * @returns {string} Formatted date range
     */
    formatDateRange(event) {
        if (!event.start) return ''

        const startFormat = event.isAllDay ? 'DD.MM.YYYY' : 'DD.MM.YYYY HH:mm'
        const startStr = event.start.format(startFormat)

        if (!event.end || event.start.isSame(event.end, 'day')) {
            // Same day event
            if (event.isAllDay) {
                return startStr
            }
            // Show end time if different
            if (event.end && !event.start.isSame(event.end, 'minute')) {
                return `${startStr} – ${event.end.format('HH:mm')}`
            }
            return startStr
        }

        // Multi-day event
        const endFormat = event.isAllDay ? 'DD.MM.YYYY' : 'DD.MM.YYYY HH:mm'
        return `${startStr} – ${event.end.format(endFormat)}`
    }

    /**
     * Show error state
     * @param {Error} error - Error object
     */
    showError(error) {
        console.error('Failed to load calendar:', error)
        this.upcomingContainer.innerHTML = `
            <div class="card margin-top">
                <div class="card-body">
                    <h4 class="card-title">⚠️ Fehler</h4>
                    <p class="card-text">Kalender konnte nicht geladen werden. Bitte später erneut versuchen.</p>
                </div>
            </div>
        `
        this.pastContainer.innerHTML = ''
    }
}

// ============================================================
// Initialize
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
    const upcomingDates = document.getElementById('upcomingDates')
    const passedDates = document.getElementById('passedDates')
    const template = document.getElementById('template')

    if (!upcomingDates || !passedDates || !template) {
        console.error('Required DOM elements not found')
        return
    }

    const renderer = new EventRenderer(upcomingDates, passedDates, template)

    // Fetch and parse calendar
    fetch(CORS_PROXY + CALENDAR_URL)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }
            return response.text()
        })
        .then(icsString => {
            const events = ICSParser.parse(icsString)
            renderer.render(events)
            template.remove()
        })
        .catch(error => {
            renderer.showError(error)
        })
})

// ============================================================
// Theme Toggle
// ============================================================
function setTheme(initial = false) {
    if (!initial) {
        dark = dark === 'true' ? 'false' : 'true'
    }
    localStorage.setItem('dark', dark)
    document.body.classList.toggle('dark', dark === 'true')
}

let dark = localStorage.getItem('dark') || 'false'
if (dark === 'true') {
    document.body.classList.add('dark')
}
