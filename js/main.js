dayjs.extend(dayjs_plugin_relativeTime)

const calendarURL = 'https://cloud.jupeters.de/remote.php/dav/public-calendars/rgNpg4W5S92DytyZ?export'

const tbody = document.createElement('tbody')
const thead = document.getElementById('theadtr')

const validKeys = ['RELATIVE', 'DTSTART', 'DTEND', 'SUMMARY', 'DESCRIPTION']
const translateKeys = {
    'RELATIVE': 'Wann',
    'DTSTART': 'Begin',
    'DTEND': 'Ende',
    'SUMMARY': 'Event',
    'DESCRIPTION': 'Infos'
}

fetch('https://calendar.logge.workers.dev/' + calendarURL).then(response => response.text().then(icsString => {

    let events = []
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
                console.log(value, dayjs(value).fromNow())
                collector['RELATIVE'] = dayjs(value).fromNow()
            }
            if (property === "DTSTART" || property === "DTEND") {
                const date = dayjs(value)
                if (date.hour() == "0" && date.minute() == "0") value = date.format('DD/MM/YYYY')
                else value = date.format('DD/MM/YYYY HH:mm')
            }
            collector[property] = value
        }
    }

    for (let i = 0; i < validKeys.length; i++) {
        const th = document.createElement('th')
        th.innerText = translateKeys[validKeys[i]]
        thead.append(th)
    }
    console.log(events)

    for (let i = 0; i < events.length; i++) {
        const tr = document.createElement('tr')
        for (let l = 0; l < validKeys.length; l++) {
            const td = document.createElement('td')
            td.innerText = events[i][validKeys[l]] || ''
            tr.append(td)
        }
        tbody.append(tr)
    }
    document.getElementById('table').append(tbody)
}))
