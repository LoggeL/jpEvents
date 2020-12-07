function calendar() {
    document.getElementById('table').innerHTML = ' <thead><tr id="theadtr"></tr></thead>'
    const tbody = document.createElement('tbody')
    const thead = document.getElementById('theadtr')
    const calendarURL = document.getElementById('url').value
    fetch('https://calendar.logge.workers.dev/' + calendarURL).then(response => response.text().then(icsString => {

        console.log(icsString)

        let events = []
        let collector = {}
        let start = false
        const lines = icsString.split("\n");
        for (i = 0; i < lines.length; i++) {
            const line = lines[i]
            if (line.startsWith('BEGIN:VEVENT')) {
                if (Object.keys(collector).length > 0) events.push(collector)
                collector = {}
                start = true
            }
            else if (!start) continue
            else {
                let split = line.split(':')
                const property = split.shift().replace(';VALUE=DATE', '')
                collector[property] = split.join(':').trim().replace('\\,', ',')
            }
        }

        const keys = Object.keys(events[0])
        for (let i = 0; i < keys.length; i++) {
            const th = document.createElement('th')
            th.innerText = keys[i]
            thead.append(th)
        }

        for (let i = 0; i < events.length; i++) {
            const tr = document.createElement('tr')
            const values = Object.values(events[i])
            for (let l = 0; l < values.length; l++) {
                const td = document.createElement('td')
                td.innerText = values[l]
                tr.append(td)
            }
            tbody.append(tr)
        }
        document.getElementById('table').append(tbody)
    }))
}