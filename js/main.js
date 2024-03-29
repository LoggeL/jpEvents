dayjs.extend(dayjs_plugin_relativeTime)

const calendarURL = 'https://nextcloud.jupeters.de/remote.php/dav/public-calendars/2MTfKNgsWXQZ7MDN?export'

const upcomingDates = document.getElementById('upcomingDates')
const passedDates = document.getElementById('passedDates')

const template = document.getElementById('template')
let events = []

fetch('https://calendar.logge.workers.dev/' + calendarURL).then(response => response.text().then(icsString => {

    template.style.display = 'block'

    upcomingDates.innerHTML = ''
    passedDates.innerHTML = ''

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
                const date = dayjs(value)
                collector['RELATIVE'] = date.fromNow()
                collector['START_TIMESTAMP'] = date.valueOf()
                if (date.hour() == "0" && date.minute() == "0") value = date.format('DD/MM/YYYY')
                else value = date.format('DD/MM/YYYY HH:mm')
            }
            else if (property === "DTEND") {
                const date = dayjs(value)
                collector['END_TIMESTAMP'] = date.valueOf()
                if (date.hour() == "0" && date.minute() == "0") value = date.format('DD/MM/YYYY')
                else if (date.isSame(collector['START_TIMESTAMP'], 'day')) value = date.format('HH:mm')
                else value = date.format('DD/MM/YYYY HH:mm')
            }
            else if (property === "DESCRIPTION") {
                try {
                    collector['URL'] = new URL(value)
                } catch (e) {
                    console.error(e)
                }
            }
            collector[property] = value
        }
    }

    events = events.sort((a, b) => a.START_TIMESTAMP - b.START_TIMESTAMP)
    if (events.filter(e => e.END_TIMESTAMP < Date.now()).length === 0) passedDates.previousElementSibling.remove()
    if (events.filter(e => e.START_TIMESTAMP > Date.now()).length === 0) upcomingDates.previousElementSibling.remove()

    for (let i = 0; i < events.length; i++) {
        const event = events[i]
        if (dayjs(event.DTEND).isBefore(dayjs().subtract(1, 'year'))) continue
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
            passedDates.prepend(template.cloneNode(true))
        }
        else {
            children[1].innerText = event.RELATIVE
            upcomingDates.append(template.cloneNode(true))
        }
    }
    template.remove()
}))

function setTheme(first) {
    if (!first) dark = (dark == "true" ? "false" : "true")
    localStorage.setItem('dark', dark)
    document.body.classList.toggle('dark')
}

let dark = localStorage.getItem('dark')
if (dark == "true") setTheme(true)