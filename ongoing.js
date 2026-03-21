const CONFIG = {
    API_BASE: 'https://api.openf1.org/v1',
    REFRESH_INTERVAL: 60000, 
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
    currentSeason: 2026,
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
    await fetchAndDisplayData();
    setupEventListeners();
    
    setInterval(async () => {
        await fetchAndDisplayData();
    }, CONFIG.REFRESH_INTERVAL);
}

async function fetchAndDisplayData() {
    showStatus('Syncing Live Standings...', 'info');
    try {
        const data = await fetchSeasonData();
        if (data && data.drivers.length > 0) {
            state.drivers = data.drivers;
            state.raceHistory = data.history;
            
            saveDataToStorage(state.drivers);
            saveRaceHistoryToStorage(state.raceHistory);
            updateLastUpdateTime();
            
            displayCharts();
            populateDriverSelect();
            displayVotingResults();
            showStatus('Live Data Synchronized', 'success');
        } else {
            showStatus('Waiting for 2026 Race Results...', 'info');
        }
    } catch (error) {
        console.error('Fetch Error:', error);
        showStatus('Connection lost. Retrying...', 'error');
        loadDataFromStorage();
        displayCharts();
    }
}

async function fetchSeasonData() {
    const sessionRes = await fetch(`${CONFIG.API_BASE}/sessions?session_type=Race&year=${state.currentSeason}`);
    if (!sessionRes.ok) throw new Error('API Unreachable');
    const allSessions = await sessionRes.json();
    
    if (!Array.isArray(allSessions)) return null;

    const now = new Date();
    const completedRaces = allSessions
        .filter(s => s && s.date_start && new Date(s.date_start) < now)
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

    if (completedRaces.length === 0) return null;

    const history = [];
    for (const race of completedRaces) {
        const champRes = await fetch(`${CONFIG.API_BASE}/championship_drivers?session_key=${race.session_key}`);
        if (champRes.ok) {
            const champData = await champRes.json();
            if (Array.isArray(champData) && champData.length > 0) {
                // Fix: Check if meeting_name exists before using .replace()
                const rawName = race.meeting_name || "Unknown Grand Prix";
                const cleanName = typeof rawName === 'string' ? rawName.replace(' Grand Prix', '') : "GP";
                
                history.push({
                    raceName: cleanName,
                    standings: champData.sort((a, b) => b.points - a.points)
                });
            }
        }
        await new Promise(r => setTimeout(r, 500)); 
    }

    if (history.length === 0) return null;

    const latestRace = completedRaces[completedRaces.length - 1];
    const driverRes = await fetch(`${CONFIG.API_BASE}/drivers?session_key=${latestRace.session_key}`);
    const driversMetadata = await driverRes.json();

    const latestChamp = history[history.length - 1].standings;
    
    const processedDrivers = latestChamp.map((d, index) => {
        const meta = driversMetadata.find(m => m.driver_number === d.driver_number) || {};
        const prevChamp = history.length > 1 ? history[history.length - 2].standings : [];
        const prevData = prevChamp.find(p => p.driver_number === d.driver_number) || { points: 0 };
        
        return {
            driverId: String(d.driver_number),
            name: `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || `Driver ${d.driver_number}`,
            team: meta.team_name || 'N/A',
            seasonPoints: d.points,
            racePoints: d.points - prevData.points,
            position: index + 1
        };
    });

    return { drivers: processedDrivers, history: history };
}

function displayCharts() {
    renderBumpChart();
    renderLatestRaceResults();
    renderVotingChart();
}

function renderBumpChart() {
    const dom = document.getElementById('bumpChart');
    if (!dom || state.raceHistory.length === 0) return;
    
    if (!state.chartInstances.bump) {
        state.chartInstances.bump = echarts.init(dom);
    }

    const xAxisData = state.raceHistory.map(h => h.raceName);
    const series = state.drivers.slice(0, 10).map(d => {
        const data = state.raceHistory.map(h => {
            const entryIndex = h.standings.findIndex(s => String(s.driver_number) === d.driverId);
            return entryIndex !== -1 ? entryIndex + 1 : null;
        });

        return {
            name: d.name,
            type: 'line',
            smooth: true,
            symbolSize: 10,
            // Show points on the right side of the chart
            endLabel: {
                show: true,
                color: '#e8e8e8',
                fontSize: 11,
                distance: 10,
                formatter: (params) => {
                    const lastName = d.name.split(' ').pop();
                    return `${lastName}: ${d.seasonPoints} pts`;
                }
            },
            labelLayout: { moveOverlap: 'shiftY' },
            data: data
        };
    });

    state.chartInstances.bump.setOption({
        tooltip: { trigger: 'item', backgroundColor: '#1a2332', textStyle: { color: '#fff' } },
        grid: { left: '3%', right: '25%', bottom: '10%', containLabel: true },
        xAxis: {
            type: 'category',
            data: xAxisData,
            axisLabel: { color: '#e8e8e8' }
        },
        yAxis: {
            type: 'value',
            inverse: true,
            min: 1,
            max: 20,
            interval: 1,
            axisLabel: { color: '#e8e8e8' },
            splitLine: { lineStyle: { color: '#2a3f5f' } }
        },
        series: series
    }, true);
}

function renderLatestRaceResults() {
    const sorted = [...state.drivers].sort((a, b) => b.racePoints - a.racePoints);
    const top5 = sorted.slice(0, 5);
    const rest = sorted.slice(5);

    const cont = document.getElementById('top5Container');
    if (cont) {
        cont.innerHTML = top5.map((d, i) => `
            <div class="top5-bar-wrapper">
                <div class="top5-info">
                    <img src="placeholder_car.png" class="top5-car-img" />
                    <span class="top5-driver-name">${d.name.split(' ').pop()}</span>
                    <span class="top5-points">${d.racePoints} pts</span>
                </div>
                <div class="top5-bar pos-${i + 1}" style="height: ${Math.max((d.racePoints / 25) * 100, 15)}%"></div>
            </div>`).join('');
    }

    const canvas = document.getElementById('restOfGridChart');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (state.chartInstances.restOfGrid) state.chartInstances.restOfGrid.destroy();
        state.chartInstances.restOfGrid = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: rest.map(d => d.name),
                datasets: [{
                    data: rest.map(d => d.racePoints),
                    backgroundColor: '#2a3f5f',
                    borderRadius: 4
                }]
            },
            options: {
                indexAxis: 'y',
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { color: '#2a3f5f' }, ticks: { color: '#e8e8e8' } },
                    y: { grid: { display: false }, ticks: { color: '#e8e8e8' } }
                }
            }
        });
    }
}

function renderVotingChart() {
    const canvas = document.getElementById('voteChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (state.chartInstances.vote) state.chartInstances.vote.destroy();
    
    const sorted = Object.entries(state.votes).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const total = Object.values(state.votes).reduce((a, b) => a + b, 0);
    
    document.getElementById('totalVotes').textContent = total;
    
    state.chartInstances.vote = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(v => v[0]),
            datasets: [{
                data: sorted.map(v => v[1]),
                backgroundColor: '#c41e3a',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { ticks: { color: '#e8e8e8' } }
            }
        }
    });
}

function populateDriverSelect() {
    const s = document.getElementById('driverSelect');
    if (!s || s.options.length > 1) return;
    state.drivers.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.driverId;
        opt.textContent = `${d.name} (${d.team})`;
        s.appendChild(opt);
    });
}

function setupEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => fetchAndDisplayData());
    document.getElementById('voteSubmitBtn')?.addEventListener('click', () => {
        const id = document.getElementById('driverSelect').value;
        const d = state.drivers.find(drv => drv.driverId === id);
        if (d) {
            state.votes[d.name] = (state.votes[d.name] || 0) + 1;
            state.userVote = { driverName: d.name };
            saveVotesToStorage();
            renderVotingChart();
            document.getElementById('yourVote').textContent = d.name;
            showStatus(`Vote registered for ${d.name}`, 'success');
        }
    });
}

function saveDataToStorage(d) { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA, JSON.stringify(d)); }
function loadDataFromStorage() { 
    const d = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.DRIVERS_DATA); 
    const h = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY);
    if (d) state.drivers = JSON.parse(d); 
    if (h) state.raceHistory = JSON.parse(h);
}
function saveRaceHistoryToStorage(h) { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.RACE_HISTORY, JSON.stringify(h)); }
function saveVotesToStorage() { localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES, JSON.stringify(state.votes)); }
function loadVotesFromStorage() {
    const v = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES);
    if (v) state.votes = JSON.parse(v);
}
function updateLastUpdateTime() {
    const t = new Date().toLocaleString();
    if (document.getElementById('lastUpdate')) document.getElementById('lastUpdate').textContent = `Live Status: ${t}`;
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.LAST_UPDATE, t);
}
function showStatus(m, t) {
    const el = document.getElementById('statusMessage');
    if (el) { el.textContent = m; el.className = `status-message ${t}`; }
}
