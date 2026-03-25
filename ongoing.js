const CONFIG = {
    API_BASE: 'https://api.openf1.org/v1',
    REFRESH_INTERVAL: 60000, 
    LOCAL_STORAGE_KEYS: {
        DRIVERS_DATA: 'f1_drivers_data',
        RACE_HISTORY: 'f1_race_history',
        LAST_UPDATE: 'f1_last_update',
        VOTES: 'f1_category_votes',
        USER_VOTES: 'f1_user_category_votes'
    },
    CATEGORIES: ['dotd', 'overtake', 'surprise'],
    VOTE_COOLDOWN_MS: 24 * 60 * 60 * 1000
};

const TEAM_COLORS = {
    'Red Bull Racing': '#3671C6',
    'Ferrari': '#E8002D',
    'Mercedes': '#27F4D2',
    'McLaren': '#FF8000',
    'Aston Martin': '#229971',
    'Alpine': '#FF87BC',
    'Williams': '#64C4FF',
    'Racing Bulls': '#6692FF',
    'Sauber': '#52E252',
    'Haas F1 Team': '#B6BABD'
};

const state = {
    drivers: [],
    raceHistory: [],
    votes: { dotd: {}, overtake: {}, surprise: {} },
    userVotes: { dotd: null, overtake: null, surprise: null },
    lastUpdate: null,
    currentSeason: 2026,
    chartInstances: {
        bump: null,
        restOfGrid: null,
        chart_dotd: null,
        chart_overtake: null,
        chart_surprise: null
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

async function initializeApp() {
    loadVotesFromStorage();
    await fetchAndDisplayData();
    setupEventListeners();
    updateVotingVisibility();
    
    setInterval(async () => {
        await fetchAndDisplayData();
    }, CONFIG.REFRESH_INTERVAL);

    setInterval(updateVotingVisibility, 60000);
}

async function fetchAndDisplayData() {
    showStatus('Syncing Live 2026 Standings...', 'info');
    try {
        const data = await fetchSeasonData();
        if (data && data.drivers.length > 0) {
            state.drivers = data.drivers;
            state.raceHistory = data.history;
            
            saveDataToStorage(state.drivers);
            saveRaceHistoryToStorage(state.raceHistory);
            updateLastUpdateTime();
            
            displayCharts();
            populateDriverSelects();
            renderAllVotingCharts();
            showStatus('Live Data Synchronized', 'success');
        } else {
            showStatus('No completed 2026 races found.', 'info');
        }
    } catch (error) {
        showStatus('Connection error. Retrying...', 'error');
        loadDataFromStorage();
        displayCharts();
        populateDriverSelects();
        renderAllVotingCharts();
    }
}

async function fetchSeasonData() {
    const sessionRes = await fetch(`${CONFIG.API_BASE}/sessions?session_type=Race&year=${state.currentSeason}`);
    if (!sessionRes.ok) throw new Error('API Error');
    const allSessions = await sessionRes.json();
    
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
                const rawName = race.meeting_name || race.location || race.circuit_short_name || "Unknown GP";
                const cleanName = rawName.replace(' Grand Prix', '');
                
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
        const prevData = prevChamp.find(p => p.driver_number === d.driver_number) || { points: 0, points_current: 0, points_start: 0 };
        
        const currentPts = d.points ?? d.points_current ?? d.points_start ?? 0;
        const pastPts = prevData.points ?? prevData.points_current ?? prevData.points_start ?? 0;

        return {
            driverId: String(d.driver_number),
            name: `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || `Driver ${d.driver_number}`,
            team: meta.team_name || 'N/A',
            // Capture the headshot URL, defaulting to placeholder if it doesn't exist
            headshot_url: meta.headshot_url || 'placeholder_car.png', 
            seasonPoints: currentPts,
            racePoints: Math.max(0, currentPts - pastPts),
            position: index + 1
        };
    });

    return { drivers: processedDrivers, history: history };
}

function displayCharts() {
    renderBumpChart();
    renderLatestRaceResults();
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
            symbolSize: 8,
            endLabel: {
                show: true,
                color: '#e8e8e8',
                fontSize: 12,
                distance: 15,
                formatter: () => {
                    const lastName = d.name.split(' ').pop();
                    return `${lastName}: ${d.seasonPoints || 0} pts`;
                }
            },
            labelLayout: { moveOverlap: 'shiftY' },
            emphasis: { focus: 'series' },
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
    const p1 = sorted[0];
    const p2 = sorted[1];
    const p3 = sorted[2];
    const p4 = sorted[3];
    const p5 = sorted[4];

    const podiumOrder = [
        { driver: p4, pos: 4 },
        { driver: p2, pos: 2 },
        { driver: p1, pos: 1 },
        { driver: p3, pos: 3 },
        { driver: p5, pos: 5 }
    ].filter(item => item.driver);

    const rest = sorted.slice(5);

    const maxPoints = Math.max(...podiumOrder.map(item => item.driver.racePoints), 1);

    const cont = document.getElementById('top5Container');
    if (cont) {
        cont.innerHTML = podiumOrder.map(item => `
            <div class="top5-bar-wrapper">
                <div class="top5-info">
                    <img src="${item.driver.headshot_url}" class="top5-car-img" alt="${item.driver.name}" onerror="this.src='placeholder_car.png'" />
                    <span class="top5-driver-name">${item.driver.name.split(' ').pop()}</span>
                    <span class="top5-points">${item.driver.racePoints} pts</span>
                </div>
                <div class="top5-bar pos-${item.pos}" style="height: ${Math.max((item.driver.racePoints / 25) * 100, 15)}%"></div>
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
                    backgroundColor: rest.map(d => TEAM_COLORS[d.team] || '#2a3f5f'),
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

function renderAllVotingCharts() {
    CONFIG.CATEGORIES.forEach(cat => renderVotingChart(cat));
}

function getDriverTeamColor(driverName) {
    const driver = state.drivers.find(d => d.name === driverName);
    if (driver && driver.team && TEAM_COLORS[driver.team]) {
        return TEAM_COLORS[driver.team];
    }
    return '#c41e3a';
}

function renderVotingChart(category) {
    const canvasId = `chart_${category}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const chartKey = `chart_${category}`;
    
    if (state.chartInstances[chartKey]) {
        state.chartInstances[chartKey].destroy();
    }
    
    const catVotes = state.votes[category] || {};
    const sorted = Object.entries(catVotes).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const total = Object.values(catVotes).reduce((a, b) => a + b, 0);
    
    const totalSpan = document.getElementById(`total_${category}`);
    if (totalSpan) totalSpan.textContent = total;

    const userSpan = document.getElementById(`user_${category}`);
    if (userSpan) {
        const userVoted = state.userVotes[category];
        userSpan.textContent = userVoted ? userVoted.driverName : 'Not voted';
        userSpan.style.color = userVoted ? 'var(--accent-yellow)' : '#888';
    }
    
    state.chartInstances[chartKey] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sorted.map(v => v[0]),
            datasets: [{
                data: sorted.map(v => v[1]),
                backgroundColor: sorted.map(v => getDriverTeamColor(v[0])),
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: {
                x: { display: false },
                y: { ticks: { color: '#e8e8e8', font: { size: 10 } } }
            }
        }
    });
}

function populateDriverSelects() {
    CONFIG.CATEGORIES.forEach(cat => {
        const s = document.getElementById(`select_${cat}`);
        if (!s || s.options.length > 1) return;
        state.drivers.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.driverId;
            opt.textContent = `${d.name}`;
            s.appendChild(opt);
        });
    });
}

function handleVote(category) {
    const selectEl = document.getElementById(`select_${category}`);
    const id = selectEl.value;
    
    if (!id) {
        showStatus('Please select a driver first.', 'error');
        return;
    }

    const lastVote = state.userVotes[category];
    if (lastVote && (Date.now() - lastVote.timestamp) < CONFIG.VOTE_COOLDOWN_MS) {
        showStatus('You have already voted in this category today.', 'error');
        return;
    }

    const d = state.drivers.find(drv => drv.driverId === id);
    if (d) {
        if (!state.votes[category]) state.votes[category] = {};
        state.votes[category][d.name] = (state.votes[category][d.name] || 0) + 1;
        
        state.userVotes[category] = {
            driverId: id,
            driverName: d.name,
            timestamp: Date.now()
        };
        
        saveVotesToStorage();
        renderVotingChart(category);
        updateVotingVisibility();
        
        selectEl.value = '';
        showStatus(`Vote registered for ${d.name}`, 'success');
    }
}

function setupEventListeners() {
    document.getElementById('refreshBtn')?.addEventListener('click', () => fetchAndDisplayData());
    
    CONFIG.CATEGORIES.forEach(cat => {
        const btn = document.getElementById(`btn_${cat}`);
        if (btn) {
            btn.addEventListener('click', () => handleVote(cat));
        }
    });
}

function updateVotingVisibility() {
    const now = Date.now();
    
    CONFIG.CATEGORIES.forEach(cat => {
        const selectionArea = document.getElementById(`selection_${cat}`);
        const resultsArea = document.getElementById(`results_${cat}`);
        const timerEl = document.getElementById(`time_${cat}`);
        
        const lastVote = state.userVotes[cat];
        
        if (lastVote && (now - lastVote.timestamp) < CONFIG.VOTE_COOLDOWN_MS) {
            if (selectionArea) selectionArea.classList.add('hidden');
            if (resultsArea) resultsArea.classList.remove('hidden');
            
            if (timerEl) {
                const remainingMs = CONFIG.VOTE_COOLDOWN_MS - (now - lastVote.timestamp);
                const hrs = Math.floor(remainingMs / (1000 * 60 * 60));
                const mins = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
                timerEl.textContent = `Next vote available in: ${hrs}h ${mins}m`;
            }
        } else {
            if (selectionArea) selectionArea.classList.remove('hidden');
            if (resultsArea) resultsArea.classList.add('hidden');
            if (timerEl) timerEl.textContent = '';
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

function saveVotesToStorage() { 
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES, JSON.stringify(state.votes)); 
    localStorage.setItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTES, JSON.stringify(state.userVotes)); 
}

function loadVotesFromStorage() {
    const v = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.VOTES);
    if (v) {
        const parsed = JSON.parse(v);
        if (parsed.dotd) {
            state.votes = parsed;
        } else {
            state.votes = { dotd: parsed, overtake: {}, surprise: {} };
        }
    }
    
    const uv = localStorage.getItem(CONFIG.LOCAL_STORAGE_KEYS.USER_VOTES);
    if (uv) {
        const parsed = JSON.parse(uv);
        if (parsed.dotd !== undefined) {
            state.userVotes = parsed;
        }
    }
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
