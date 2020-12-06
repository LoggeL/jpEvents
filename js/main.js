function calendar() {
    document.getElementById('table').innerHTML = ' <thead><tr id="theadtr"></tr></thead>'
    const tbody = document.createElement('tbody')
    const thead = document.getElementById('theadtr')
    const calendarURL = document.getElementById('url').value
    fetch('https://calendar.logge.workers.dev/' + calendarURL).then(response => response.text().then(icsString => {
        jcalData = ICAL.parse(icsString)
        console.log(jcalData)
        const events = jcalData[2]

        const firstEvent = jcalData[2][0][1]
        console.log(firstEvent)
        for (let i = 0; i < firstEvent.length; i++) {
            const th = document.createElement('th')
            th.innerText = firstEvent[i][0]
            thead.append(th)
        }

        for (let i = 0; i < events.length; i++) {
            const tr = document.createElement('tr')
            for (let l = 0; l < events[i][1].length; l++) {
                const td = document.createElement('td')
                td.innerText = events[i][1][l][3]
                tr.append(td)
            }
            tbody.append(tr)
        }
        document.getElementById('table').append(tbody)
    }))
}