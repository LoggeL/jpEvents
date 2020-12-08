dayjs.extend(dayjs_plugin_relativeTime)

const calendarURL = 'https://cloud.jupeters.de/remote.php/dav/public-calendars/rgNpg4W5S92DytyZ?export'

const upcomingDates = document.getElementById('upcomingDates')
const passedDates = document.getElementById('passedDates')

const template = document.getElementById('template')
let events = []

fetch('https://calendar.logge.workers.dev/' + calendarURL).then(response => response.text().then(icsString => {

    template.style.display = 'block'

    let collector = {}
    let start = false
    const lines = icsString.split("\n");
    for (i = 0; i <= lines.length; i++) {
        const line = lines[i]
        if (!line || line.startsWith('BEGIN:VEVENT')) {
            if (Object.keys(collector).length > 0) events.push(collector)
            collector = {}
            start = true
        }
        else if (!start) continue
        else {
            let split = line.split(':')
            const property = split.shift().split(';')[0]
            let value = split.join(':').trim().replace('\\,', ',')
            if (property === "DTSTART") {
                collector['RELATIVE'] = dayjs(value).fromNow()
                collector['START_TIMESTAMP'] = dayjs(value).valueOf()
            }
            else if (property === "DTEND") {
                collector['END_TIMESTAMP'] = dayjs(value).valueOf()
            }
            else if (property === "DESCRIPTION") {
                try {
                    collector['URL'] = new URL(value)
                } catch (e) {
                    console.error(e)
                }
            }
            if (property === "DTSTART" || property === "DTEND") {
                const date = dayjs(value)
                if (date.hour() == "0" && date.minute() == "0") value = date.format('DD/MM/YYYY')
                else value = date.format('DD/MM/YYYY HH:mm')
            }
            collector[property] = value
        }
    }

    events = events.sort((a, b) => a.START_TIMESTAMP - b.START_TIMESTAMP)
    if (events.filter(e => e.END_TIMESTAMP < Date.now()).length === 0) passedDates.previousElementSibling.remove()
    if (events.filter(e => e.START_TIMESTAMP > Date.now()).length === 0) upcomingDates.previousElementSibling.remove()

    for (let i = 0; i < events.length; i++) {
        const event = events[i]
        let children = template.children[0].children
        children[0].innerText = event.SUMMARY + ' ' + (event.LOCATION ? event.LOCATION : '')
        children[2].innerText = event.DTSTART + ' bis ' + event.DTEND
        if (event.URL) {
            children[3].setAttribute('href', event.URL)
            children[3].style.display = 'block'
        }
        else {
            children[3].style.display = 'none'
        }
        if (event.END_TIMESTAMP < Date.now()) {
            children[1].innerText = dayjs(event.END_TIMESTAMP).fromNow()
            passedDates.append(template.cloneNode(true))
        }
        else {
            children[1].innerText = event.RELATIVE
            upcomingDates.append(template.cloneNode(true))
        }
    }
    template.remove()
}))
