const CONFIG = {
    API_BASE: 'https://api.openf1.org/v1',
    REFRESH_INTERVAL: 24 * 60 * 60 * 1000,
    LOCAL_STORAGE_KEYS: {
        DRIVERS_DATA: 'f1_drivers_data',
        RACE_HISTORY: 'f1_race_history',
        LAST_UPDATE: 'f1_last_update',
        USER_VOTE: 'f1_user_vote',
        VOTES: 'f1_votes'
    }
};

const state = {
    drivers: [],
    raceHistory: [],
    votes: {},
    userVote: null,
    lastUpdate: null,
    currentSeason: new Date().getFullYear(),
    chartInstances: {
        bump: null,
        restOfGrid: null,
        vote: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    loadVotesFromStorage();
    const lastUpdate = getLastUpdateTime();
    if (shouldRefreshData(lastUpdate)) {
        await fetchAndDisplayData();
    } else {
        loadDataFromStorage();
        displayCharts();
        populateDriverSelect();
        displayVotingResults();
    }
    setupEventListeners();
    setInterval(() => {
        const lastUpdate = getLastUpdateTime();
        if (shouldRefreshData(lastUpdate)) {
            fetchAndDisplayData();
        }
    }, 3600000);
}

async function fetchAndDisplayData() {
    showStatus('Fetching latest F1 data...', 'info');
    try {
        const standings = await fetchSeasonStandings();
        if (standings && standings.length > 0) {
            state.drivers = standings;
            saveDataToStorage(standings);
            saveRaceHistoryToStorage(state.raceHistory);
            updateLastUpdateTime();
            displayCharts();
            populateDriverSelect();
            displayVotingResults();
            showStatus('Data refreshed successfully!', 'success');
        } else {
            showStatus('No data available. Loading samples.', 'error');
            loadSampleData();
            displayCharts();
            populateDriverSelect();
            displayVotingResults();
        }
    } catch (error) {
        showStatus('Error fetching data.', 'error');
        loadDataFromStorage();
        displayCharts();
        populateDriverSelect();
        displayVotingResults();
    }
}

async function fetchSeasonStandings() {
    try {
        const season = state.currentSeason;
        const sessionsRes = await fetch(`${CONFIG.API_BASE}/sessions?session_type=Race&year=${season}`);
        if (!sessionsRes.ok) throw new Error(sessionsRes.status);
        const allSessions = await sessionsRes.json();
        const now = new Date();
        const completedRaces = allSessions
            .filter(s => new Date(s.date_start) < now)
            .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));
        if (completedRaces.length === 0) return [];
        const latestRace = completedRaces[completedRaces.length - 1];
        const driversRes = await fetch(`${CONFIG.API_BASE}/drivers?session_key=${latestRace.session_key}`);
        const drivers = await driversRes.json();
        const resultsPromises = completedRaces.map(race => 
            fetch(`${CONFIG.API_BASE}/results?session_key=${race.session_key}`).then(res => res.json())
        );
        const allRaceResults = await Promise.all(resultsPromises);
        return processDriversData(drivers, completedRaces, allRaceResults);
    } catch (error) {
        throw error;
    }
}

function processDriversData(drivers, completedRaces, allRaceResults) {
    const cumulativePoints = {};
    const driversInfo = {};
    drivers.forEach(d => {
        const dNum = d.driver_number;
        cumulativePoints[dNum] = 0;
        driversInfo[dNum] = {
            driverId: dNum,
            name: `${d.first_name || ''} ${d.last_name || ''}`.trim(),
            team: d.team_name,
            racePoints: 0,
            seasonPoints: 0
        };
    });
    state.raceHistory = completedRaces.map((race, index) => {
        const results = allRaceResults[index];
        results.forEach(res => {
            const dNum = res.driver_number;
            if (cumulativePoints.hasOwnProperty(dNum)) {
                cumulativePoints[dNum] += (res.points || 0);
                if (index === completedRaces.length - 1) {
                    driversInfo[dNum].racePoints = res.points || 0;
                }
            }
        });
        const currentStandings = Object.keys(cumulativePoints)
            .map(dNum => ({ driverId: parseInt(dNum), total: cumulativePoints[dNum] }))
            .sort((a, b) => b.total - a.total);
        return {
            raceName: race.meeting_name.replace(' Grand Prix', ''),
            positions: currentStandings.map((d, i) => ({
                driverId: d.driverId,
                position: i + 1
            }))
        };
    });
    const finalDrivers = Object.values(driversInfo).map(d => {
        d.seasonPoints = cumulativePoints[d.driverId];
        return d;
    }).sort((a, b) => b.seasonPoints - a.seasonPoints);
    finalDrivers.forEach((d, i) => { d.position = i + 1; });
    return finalDrivers;
}

function displayCharts() {
    renderBumpChart();
    renderLatestRaceResults();
    renderVotingChart();
}

function renderBumpChart() {
    const chartDom = document.getElementById('bumpChart');
    if (!chartDom) return;
    if (!state.chartInstances.bump) state.chartInstances.bump = echarts.init(chartDom);
    const races = state.raceHistory.map(race => race.raceName);
    const seriesData = state.drivers.slice(0, 10).map(driver => {
        const dataPoints = state.raceHistory.map(race => {
            const pos = race.positions.find(p => p.driverId === driver.driverId);
            return pos ? pos.position : null;
        });
        return {
            name: driver.name,
            type: 'line',
            smooth: true,
            symbolSize: 8,
            data: dataPoints
        };
    });
    const option = {
        tooltip: { trigger: 'item' },
        grid: { left: '5%', right: '15%', bottom: '10%', containLabel: true },
        xAxis: { type: 'category', data: races, axisLabel: { color: '#e8e8e8' } },
        yAxis: { type: 'value', inverse: true, min: 1, max: 20, axisLabel: { color: '#e8e8e8' }, splitLine: { lineStyle: { color: '#2a3f5f' } } },
        series: seriesData
    };
    state.chartInstances.bump.setOption(option);
}

function renderLatestRaceResults() {
    const sorted = [...state.drivers].sort((a, b) => b.racePoints - a.racePoints);
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);
    renderTop5HTML(top5);
    renderRestOfGridChart(rest);
}

function renderTop5HTML(top5Drivers) {
    const container = document.getElementById('top5Container');
    if (!container) return;
    container.innerHTML = '';
    const maxPoints = top5Drivers.length > 0 ? Math.max(...top5Drivers.map(d => d.racePoints), 25) : 25;
    top5Drivers.forEach((driver, index) => {
        const heightPct = Math.max((driver.racePoints / maxPoints) * 100, 15);
        const wrapper = document.createElement('div');
        wrapper.className = 'top5-bar-wrapper';
        wrapper.innerHTML = `
            <div class="top5-info">
                <img src="placeholder_car.png" alt="Car" class="top5-car-img" />
                <span class="top5-driver-name">${driver.name.split(' ').pop()}</span>
                <span class="top5-points">${driver.racePoints} pts</span>
            </div>
            <div class="top5-bar pos-${index + 1}" style="height: ${heightPct}%"></div>
        `;
        container.appendChild(wrapper);
    });
}

function renderRestOfGridChart(restDrivers) {
    const canvas = document.getElementById('restOfGridChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.chartInstances.restOfGrid) state.chartInstances.restOfGrid.destroy();
    state.chartInstances.restOfGrid = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: restDrivers.map(d => d.name),
            datasets: [{
                label: 'Points',
                data: restDrivers.map(d => d.racePoints),
                backgroundColor: '#2a3f5f',
                borderColor: '#60a5fa',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#2a3f5f' }, ticks: { color: '#e8e8e8' } },
                y: { grid: { display: false }, ticks: { color: '#e8e8e8' } }
            }
        }
    });
}

function renderVotingChart() {
    const canvas = document.getElementById('voteChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.chartInstances.vote) state.chartInstances.vote.destroy();
    const sortedVotes = Object.entries(state.votes).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const labels = sortedVotes.map(v => v[0]);
    const data = sortedVotes.map(v => v[1]);
    const total = data.reduce((s, c) => s + c, 0);
    document.getElementById('totalVotes').textContent = total;
    const yourVoteSpan = document.getElementById('yourVote');
    if (yourVoteSpan) {
        yourVoteSpan.textContent = state.userVote ? state.userVote.driverName : 'Not voted';
        yourVoteSpan.style.color = state.userVote ? 'var(--accent-yellow)' : '#888';
    }
    state.chartInstances.vote = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{ data: data, backgroundColor: '#c41e3a', borderRadius: 4 }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: { label: (ctx) => `${ctx.raw} votes (${total > 0 ? ((ctx.raw / total) * 100).toFixed(1) : 0}%)` }
                }
            },
            scales: { x: { display: false }, y: { grid: { display: false }, ticks: { color: '#e8e8e8' } } }
        }
    });
}

function populateDriverSelect() {
    const select = document.getElementById('driverSelect');
    if (!select) return;
    select.innerHTML = '<option value="">-- Choose a driver --</option>';
    state.drivers.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.driverId;
        opt.textContent = `${d.name} (${d.team})`;
        select.appendChild(opt);
    });
}

function voteForDriver(e) {
    if (e) e.preventDefault();
    const select = document.getElementById('driverSelect');
    const id = parseInt(select.value);
    if (!id) return showStatus('Select a driver', 'error');
    const d = state.drivers.find(drv => drv.driverId === id);
    if (!d) return;
    state.userVote = { driverId: id, driverName: d.name };
    saveUserVoteToStorage(state.userVote);
    state.votes[d.name] = (state.votes[d.name] || 0) + 1;
    saveVotesToStorage();
    select.value = '';
    displayVotingResults();
    showStatus(`Voted for ${d.name}!`, 'success');
}

function displayVotingResults() {
    renderVotingChart();
}

function saveDataToStorage(d) { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(d)); }
function loadDataFromStorage() { const d = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA); if (d) state.drivers = JSON.parse(d); }
function saveRaceHistoryToStorage(h) { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY, JSON.stringify(h)); }
function saveVotesToStorage() { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES, JSON.stringify(state.votes)); }
function loadVotesFromStorage() {
    const v = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES); if (v) state.votes = JSON.parse(v);
    const uv = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTE); if (uv) state.userVote = JSON.parse(uv);
    const h = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY); if (h) state.raceHistory = JSON.parse(h);
}
function saveUserVoteToStorage(v) { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTE, JSON.stringify(v)); }
function updateLastUpdateTime() {
    const now = new Date().toISOString();
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE, now);
    if (document.getElementById('lastUpdate')) document.getElementById('lastUpdate').textContent = `Last Updated: ${new Date(now).toLocaleString()}`;
}
function getLastUpdateTime() { const t = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE); return t ? new Date(t) : null; }
function shouldRefreshData(t) { return !t || (Date.now() - t.getTime() > CONFIG.REFRESH_INTERVAL); }
function showStatus(m, t) {
    const el = document.getElementById('statusMessage');
    if (!el) return;
    el.textContent = m;
    el.className = `status-message ${t}`;
    if (t !== 'error') setTimeout(() => { el.textContent = ''; el.className = 'status-message'; }, 5000);
}
function setupEventListeners() {
    if (document.getElementById('refreshBtn')) document.getElementById('refreshBtn').addEventListener('click', () => fetchAndDisplayData());
    if (document.getElementById('voteSubmitBtn')) document.getElementById('voteSubmitBtn').addEventListener('click', voteForDriver);
}
