const API_URL = "https://localhost:7111";

const THEMES = [
    "1. Introdução à Computação",
    "2. Sistemas Operacionais",
    "3. Redes de Computadores",
    "4. Segurança da Informação"
];

const ALL_THEMES = "Todas as matérias";



// UTILITÁRIOS


function normalizeDate(date) {
    if (!date) return "";

    const value = String(date).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [day, month, year] = value.split("/");
        return `${year}-${month}-${day}`;
    }

    return value;
}

function getWeekDay(date) {
    const days = [
        "Domingo",
        "Segunda-feira",
        "Terça-feira",
        "Quarta-feira",
        "Quinta-feira",
        "Sexta-feira",
        "Sábado"
    ];

    const normalized = normalizeDate(date);
    if (!normalized) return "";

    const d = new Date(normalized + "T12:00:00");

    return Number.isNaN(d.getTime())
        ? ""
        : days[d.getDay()];
}

function formatDate(value) {
    const normalized = normalizeDate(value);

    if (!normalized) return "-";

    const [year, month, day] = normalized.split("-");

    if (!year || !month || !day) {
        return value;
    }

    return `${day}/${month}/${year}`;
}

function initials(name) {
    if (!name) return "";

    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map(part => part[0])
        .join("")
        .toUpperCase();
}

function toast(message) {
    const element = document.getElementById("toast");

    if (!element) {
        console.log(message);
        return;
    }

    element.textContent = message;
    element.classList.add("show");

    setTimeout(() => {
        element.classList.remove("show");
    }, 2200);
}

function populateSelect(id, values, first = true) {
    const element = document.getElementById(id);

    if (!element) return;

    element.innerHTML =
        (first ? '<option value="">Selecione...</option>' : "") +
        values
            .map(value => `<option value="${value}">${value}</option>`)
            .join("");
}



// CONFIGURAÇÕES GERAIS


function setupCommon() {
    const logout = document.getElementById("logout");

    if (logout) {
        logout.onclick = () => {
            sessionStorage.removeItem("logged");
            location.href = "index.html";
        };
    }
}



// API - ALUNOS


async function getStudentsFromAPI() {
    const response = await fetch(`${API_URL}/api/alunos`);

    if (!response.ok) {
        throw new Error("Erro ao buscar alunos no banco de dados.");
    }

    const alunos = await response.json();

    return alunos.map(aluno => ({
        id: String(aluno.idAluno),
        name: aluno.nome,

        idClass:
            aluno.idTurma === null || aluno.idTurma === undefined
                ? null
                : String(aluno.idTurma),

        className: aluno.turma || "",

        idSeries:
            aluno.idSerie === null || aluno.idSerie === undefined
                ? null
                : String(aluno.idSerie),

        series: aluno.serie || "",
        shift: aluno.turno || "",
        registrationDate: aluno.dataCadastro,
        active: aluno.ativo
    }));
}

async function createStudentAPI(student) {
    const response = await fetch(`${API_URL}/api/alunos`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nome: student.name,
            idTurma: Number(student.idClass)
        })
    });

    if (!response.ok) {
        let message = "Não foi possível cadastrar o aluno.";

        try {
            const error = await response.json();

            if (error.mensagem) {
                message = error.mensagem;
            }
        } catch {
            // Mantém a mensagem padrão.
        }

        throw new Error(message);
    }

    return await response.json();
}

async function updateStudentAPI(id, student) {
    let idClass = student.idClass;

    // Compatibilidade com telas antigas que enviem série + turno.
    if (!idClass && student.series && student.shift) {
        const classes = await getClassesFromAPI();

        const matches = classes.filter(item =>
            item.series === student.series &&
            item.shift === student.shift
        );

        if (matches.length === 1) {
            idClass = matches[0].id;
        }
    }

    if (!idClass) {
        throw new Error("Selecione uma turma para o aluno.");
    }

    const response = await fetch(`${API_URL}/api/alunos/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nome: student.name,
            idTurma: Number(idClass)
        })
    });

    if (!response.ok) {
        let message = "Não foi possível atualizar o aluno.";

        try {
            const error = await response.json();

            if (error.mensagem) {
                message = error.mensagem;
            }
        } catch {
            // Mantém a mensagem padrão.
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    return await response.json();
}

async function deleteStudentAPI(id) {
    const response = await fetch(`${API_URL}/api/alunos/${id}`, {
        method: "DELETE"
    });

    if (!response.ok) {
        let message = "Não foi possível excluir o aluno.";

        try {
            const error = await response.json();

            if (error.mensagem) {
                message = error.mensagem;
            }
        } catch {
            // Mantém a mensagem padrão.
        }

        throw new Error(message);
    }

    if (response.status === 204) {
        return null;
    }

    const text = await response.text();

    if (!text) {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}



// API - SÉRIES


async function getSeriesFromAPI() {
    const response = await fetch(`${API_URL}/api/series`);

    if (!response.ok) {
        throw new Error("Não foi possível carregar as séries.");
    }

    const data = await response.json();

    return data.map(item => ({
        id: String(item.idSerie),
        name: item.nome,
        active: item.ativo
    }));
}

async function createSeriesAPI(name) {
    const response = await fetch(`${API_URL}/api/series`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nome: name
        })
    });

    if (!response.ok) {
        let message = "Não foi possível cadastrar a série.";

        try {
            const error = await response.json();

            if (error.mensagem) {
                message = error.mensagem;
            }
        } catch {
            // Mantém a mensagem padrão.
        }

        throw new Error(message);
    }

    return await response.json();
}



// API - TURMAS


async function getClassesFromAPI() {
    const response = await fetch(`${API_URL}/api/turmas`);

    if (!response.ok) {
        throw new Error("Não foi possível carregar as turmas.");
    }

    const data = await response.json();

    return data.map(item => ({
        id: String(item.idTurma),
        name: item.nome,
        shift: item.turno,
        active: item.ativo,
        idSeries: String(item.idSerie),
        series: item.serie
    }));
}

async function createClassAPI(classData) {
    const response = await fetch(`${API_URL}/api/turmas`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            nome: classData.name,
            idSerie: Number(classData.idSeries),
            turno: classData.shift
        })
    });

    if (!response.ok) {
        let message = "Não foi possível cadastrar a turma.";

        try {
            const error = await response.json();

            if (error.mensagem) {
                message = error.mensagem;
            }
        } catch {
            // Mantém a mensagem padrão.
        }

        throw new Error(message);
    }

    return await response.json();
}



// CHAMADA


async function initCall() {
    const studentList = document.getElementById("studentList");

    if (!studentList) return;

    const callDate = document.getElementById("callDate");
    const callTheme = document.getElementById("callTheme");
    const callClass = document.getElementById("callClass");
    const allPresent = document.getElementById("allPresent");
    const allAbsent = document.getElementById("allAbsent");

    const sTotal = document.getElementById("sTotal");
    const sPresent = document.getElementById("sPresent");
    const sAbsent = document.getElementById("sAbsent");
    const sFreq = document.getElementById("sFreq");

    let students = [];
    let attendance = {};
    let databaseRecords = [];

    // Data atual.
    if (callDate && !callDate.value) {
        const today = new Date();

        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        callDate.value = `${year}-${month}-${day}`;
    }

    // Temas disponíveis.
    if (callTheme) {
        const callThemes = [
            ALL_THEMES,
            ...THEMES
        ];

        callTheme.innerHTML = callThemes
            .map(theme => `<option value="${theme}">${theme}</option>`)
            .join("");

        callTheme.value = ALL_THEMES;
    }

    async function getAttendanceFromAPI() {
        const response = await fetch(`${API_URL}/api/presencas`);

        if (!response.ok) {
            throw new Error("Não foi possível carregar as presenças.");
        }

        return await response.json();
    }

    async function saveAttendanceToAPI(date, theme, visibleStudents) {
        // "Todas as matérias" serve apenas para visualização.
        if (!theme || theme === ALL_THEMES) {
            return;
        }

        const payload = {
            data: date,
            conteudo: theme,

            presencas: visibleStudents.map(student => ({
                idAluno: Number(student.id),
                presente: attendance[student.id] !== false
            }))
        };

        const response = await fetch(`${API_URL}/api/presencas/chamada`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let message = "Não foi possível salvar a chamada.";

            try {
                const error = await response.json();

                if (error.mensagem) {
                    message = error.mensagem;
                }

                if (error.detalhe) {
                    console.error(error.detalhe);
                }
            } catch {
                // Mantém a mensagem padrão.
            }

            throw new Error(message);
        }

        return await response.json();
    }

    // Carrega alunos ativos.
    try {
        students = await getStudentsFromAPI();
        students = students.filter(student => student.active !== false);
    } catch (error) {
        console.error(error);
        toast("Não foi possível carregar os alunos.");
        return;
    }

    async function refreshDatabaseRecords() {
        try {
            databaseRecords = await getAttendanceFromAPI();
        } catch (error) {
            console.error(error);
            databaseRecords = [];
            throw error;
        }
    }

    try {
        await refreshDatabaseRecords();
    } catch {
        toast("Não foi possível carregar as presenças.");
    }

    function loadClassFilter() {
        if (!callClass) return;

        const classes = [];

        students.forEach(student => {
            if (!student.idClass) return;

            const exists = classes.some(item =>
                String(item.id) === String(student.idClass)
            );

            if (!exists) {
                classes.push({
                    id: student.idClass,
                    name: student.className,
                    series: student.series,
                    shift: student.shift
                });
            }
        });

        classes.sort((a, b) => {
            const seriesComparison =
                (a.series || "").localeCompare(b.series || "");

            if (seriesComparison !== 0) {
                return seriesComparison;
            }

            return (a.name || "").localeCompare(b.name || "");
        });

        callClass.innerHTML =
            '<option value="">Todas as turmas</option>' +
            classes
                .map(item => {
                    const description = [
                        item.series,
                        item.name,
                        item.shift
                    ]
                        .filter(Boolean)
                        .join(" • ");

                    return `<option value="${item.id}">${description}</option>`;
                })
                .join("");
    }

    function getVisibleStudents() {
        const selectedClass = callClass
            ? callClass.value
            : "";

        if (!selectedClass) {
            return students;
        }

        return students.filter(student =>
            String(student.idClass) === String(selectedClass)
        );
    }

    function getCurrentRecords() {
        const date = callDate
            ? normalizeDate(callDate.value)
            : "";

        const theme = callTheme
            ? callTheme.value
            : "";

        return databaseRecords.filter(record => {
            const recordDate = record.dataAula
                ? String(record.dataAula).substring(0, 10)
                : "";

            const sameDate =
                normalizeDate(recordDate) === date;

            const sameTheme =
                !theme ||
                theme === ALL_THEMES ||
                record.conteudo === theme;

            return sameDate && sameTheme;
        });
    }

    function updateSummary() {
        const visibleStudents = getVisibleStudents();

        const total = visibleStudents.length;

        const present = visibleStudents.filter(student =>
            attendance[student.id] !== false
        ).length;

        const absent = total - present;

        const frequency = total
            ? Math.round((present / total) * 100)
            : 0;

        if (sTotal) {
            sTotal.textContent = total;
        }

        if (sPresent) {
            sPresent.textContent = present;
        }

        if (sAbsent) {
            sAbsent.textContent = absent;
        }

        if (sFreq) {
            sFreq.textContent = `${frequency}%`;
        }
    }

    function renderStudents() {
    const visibleStudents = getVisibleStudents();

    if (!visibleStudents.length) {
        studentList.innerHTML = `
            <div class="empty">
                Nenhum aluno encontrado para esta turma.
            </div>
        `;

        updateSummary();
        return;
    }

    studentList.innerHTML = visibleStudents.map((student, index) => {
        const present = attendance[student.id] !== false;

        return `
            <div class="student-row">
                <div class="student-info">
                    <div class="num">${index + 1}</div>

                    <div class="person">
                        ${initials(student.name)}
                    </div>

                    <div class="person-name">
                        <b>${student.name}</b>
                        <small>
                            ${[
                                student.series,
                                student.className,
                                student.shift
                            ].filter(Boolean).join(" • ")}
                        </small>
                    </div>
                </div>

                <div class="status-toggle">
                    <button
                        type="button"
                        class="${present ? "selected-present" : ""}"
                        data-student="${student.id}"
                        data-status="present"
                    >
                        ✓ Presente
                    </button>

                    <button
                        type="button"
                        class="${!present ? "selected-absent" : ""}"
                        data-student="${student.id}"
                        data-status="absent"
                    >
                        × Ausente
                    </button>
                </div>
            </div>
        `;
    }).join("");

    studentList
        .querySelectorAll("[data-student]")
        .forEach(button => {
            button.onclick = async () => {
                const id = button.dataset.student;
                const status = button.dataset.status;

                attendance[id] = status === "present";

                renderStudents();

                const date = callDate
                    ? normalizeDate(callDate.value)
                    : "";

                const theme = callTheme
                    ? callTheme.value
                    : "";

                if (
                    !date ||
                    !theme ||
                    theme === ALL_THEMES
                ) {
                    return;
                }

                try {
                    await saveAttendanceToAPI(
                        date,
                        theme,
                        getVisibleStudents()
                    );

                    await refreshDatabaseRecords();

                    toast("Chamada atualizada.");
                } catch (error) {
                    console.error(error);

                    toast(
                        error.message ||
                        "Não foi possível salvar a chamada."
                    );
                }
            };
        });

    updateSummary();
}

    async function loadExistingAttendance() {
        const visibleStudents = getVisibleStudents();
        const currentRecords = getCurrentRecords();

        visibleStudents.forEach(student => {
            const studentRecords = currentRecords.filter(record =>
                String(record.idAluno) === String(student.id)
            );

            if (!studentRecords.length) {
                attendance[student.id] = true;
                return;
            }

            if (
                callTheme &&
                callTheme.value === ALL_THEMES
            ) {
                attendance[student.id] =
                    studentRecords.some(record =>
                        record.situacao === "Presente"
                    );
            } else {
                const record = studentRecords[0];

                attendance[student.id] =
                    record.situacao === "Presente";
            }
        });

        renderStudents();
    }

    if (allPresent) {
        allPresent.onclick = async () => {
            const visibleStudents =
                getVisibleStudents();

            visibleStudents.forEach(student => {
                attendance[student.id] = true;
            });

            renderStudents();

            const date = callDate
                ? normalizeDate(callDate.value)
                : "";

            const theme = callTheme
                ? callTheme.value
                : "";

            if ( !date || !theme || theme === ALL_THEMES ) {
                return;
            }

            try {
                await saveAttendanceToAPI(
                    date,
                    theme,
                    visibleStudents
                );

                await refreshDatabaseRecords();

                toast("Todos os alunos foram marcados como presentes.");
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Não foi possível salvar a chamada."
                );
            }
        };
    }

    if (allAbsent) {
        allAbsent.onclick = async () => {
            const visibleStudents =
                getVisibleStudents();

            visibleStudents.forEach(student => {
                attendance[student.id] = false;
            });

            renderStudents();

            const date = callDate
                ? normalizeDate(callDate.value)
                : "";

            const theme = callTheme
                ? callTheme.value
                : "";

            if (
                !date ||
                !theme ||
                theme === ALL_THEMES
            ) {
                return;
            }

            try {
                await saveAttendanceToAPI(
                    date,
                    theme,
                    visibleStudents
                );

                await refreshDatabaseRecords();

                toast("Todos os alunos foram marcados como ausentes.");
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Não foi possível salvar a chamada."
                );
            }
        };
    }

    if (callClass) {
        callClass.onchange = () => {
            attendance = {};
            loadExistingAttendance();
        };
    }

    if (callDate) {
        callDate.onchange = async () => {
            attendance = {};

            try {
                await refreshDatabaseRecords();
            } catch {
                // A mensagem já será exibida pela tela.
            }

            await loadExistingAttendance();
        };
    }

    if (callTheme) {
        callTheme.onchange = async () => {
            attendance = {};
            await loadExistingAttendance();
        };
    }

    loadClassFilter();
    await loadExistingAttendance();
}


// CADASTRO DE ALUNOS


async function initStudents() {
    const studentTable = document.getElementById("studentTable");
    if (!studentTable) return;

    let students = [];
    let series = [];
    let classes = [];

    const studentName = document.getElementById("studentName");
    const studentSeries = document.getElementById("studentSeries");
    const studentClass = document.getElementById("studentClass");
    const studentForm = document.getElementById("studentForm");
    const studentSearch = document.getElementById("studentSearch");
    const seriesFilter = document.getElementById("seriesFilter");
    const classFilter = document.getElementById("classFilter");

    const modal = document.getElementById("classManagerModal");
    const openManager = document.getElementById("openClassManager");
    const closeManager = document.getElementById("closeClassManager");
    const newSeriesName = document.getElementById("newSeriesName");
    const saveSeries = document.getElementById("saveSeries");
    const seriesList = document.getElementById("seriesList");
    const newClassSeries = document.getElementById("newClassSeries");
    const newClassName = document.getElementById("newClassName");
    const newClassShift = document.getElementById("newClassShift");
    const saveClass = document.getElementById("saveClass");
    const classList = document.getElementById("classList");

    // ========================================================
    // CARREGAR DADOS
    // ========================================================

    async function loadData() {
        const result = await Promise.all([
            getStudentsFromAPI(),
            getSeriesFromAPI(),
            getClassesFromAPI()
        ]);

        students = result[0];
        series = result[1].filter(item => item.active);
        classes = result[2].filter(item => item.active);

        updateSeriesSelects();
        updateStudentClassSelect();
        updateFilters();
        renderManager();
        render();
    }

    // ========================================================
    // SÉRIES
    // ========================================================

    function updateSeriesSelects() {
        if (studentSeries) {
            const current = studentSeries.value;

            studentSeries.innerHTML = `
                <option value="">Selecione a série...</option>
            `;

            series.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item.name;
                studentSeries.appendChild(option);
            });

            if (
                current &&
                series.some(item => item.id === current)
            ) {
                studentSeries.value = current;
            }
        }

        if (newClassSeries) {
            const current = newClassSeries.value;

            newClassSeries.innerHTML = `
                <option value="">Selecione...</option>
            `;

            series.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item.name;
                newClassSeries.appendChild(option);
            });

            if (
                current &&
                series.some(item => item.id === current)
            ) {
                newClassSeries.value = current;
            }
        }
    }

    // ========================================================
    // TURMAS DO FORMULÁRIO
    // ========================================================

    function updateStudentClassSelect() {
        if (!studentSeries || !studentClass) return;

        const idSeries = studentSeries.value;
        const currentClass = studentClass.value;

        if (!idSeries) {
            studentClass.innerHTML = `
                <option value="">Selecione primeiro a série...</option>
            `;

            studentClass.disabled = true;
            return;
        }

        const filtered = classes.filter(item =>
            String(item.idSeries) === String(idSeries)
        );

        studentClass.disabled = false;

        studentClass.innerHTML = `
            <option value="">Selecione a turma...</option>
        `;

        filtered.forEach(item => {
            const option = document.createElement("option");
            option.value = item.id;
            option.textContent = `${item.name} - ${item.shift}`;
            studentClass.appendChild(option);
        });

        if (
            currentClass &&
            filtered.some(item =>
                String(item.id) === String(currentClass)
            )
        ) {
            studentClass.value = currentClass;
        }
    }

    // ========================================================
    // FILTROS
    // ========================================================

    function updateFilters() {
        if (seriesFilter) {
            const current = seriesFilter.value;

            seriesFilter.innerHTML = `
                <option value="">Todas as séries</option>
            `;

            series.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = item.name;
                seriesFilter.appendChild(option);
            });

            if (
                current &&
                series.some(item => item.id === current)
            ) {
                seriesFilter.value = current;
            }
        }

        if (classFilter) {
            const current = classFilter.value;

            const selectedSeries = seriesFilter
                ? seriesFilter.value
                : "";

            const filtered = selectedSeries
                ? classes.filter(item =>
                    String(item.idSeries) === String(selectedSeries)
                )
                : classes;

            classFilter.innerHTML = `
                <option value="">Todas as turmas</option>
            `;

            filtered.forEach(item => {
                const option = document.createElement("option");
                option.value = item.id;
                option.textContent = `${item.name} - ${item.shift}`;
                classFilter.appendChild(option);
            });

            if (
                current &&
                filtered.some(item =>
                    String(item.id) === String(current)
                )
            ) {
                classFilter.value = current;
            }
        }
    }

    // ========================================================
    // GERENCIADOR DE SÉRIES E TURMAS
    // ========================================================

    function renderManager() {
        if (seriesList) {
            seriesList.innerHTML = series.length
                ? series
                    .map(item => `
                        <span class="pill">${item.name}</span>
                    `)
                    .join("")
                : `
                    <span class="manager-empty-text">
                        Nenhuma série cadastrada.
                    </span>
                `;
        }

        if (classList) {
            classList.innerHTML = classes.length
                ? classes
                    .map(item => `
                        <tr>
                            <td><b>${item.name}</b></td>
                            <td>${item.series}</td>
                            <td>${item.shift}</td>
                        </tr>
                    `)
                    .join("")
                : `
                    <tr>
                        <td colspan="3">
                            <div class="empty">
                                Nenhuma turma cadastrada.
                            </div>
                        </td>
                    </tr>
                `;
        }
    }

    // ========================================================
    // LISTA DE ALUNOS
    // ========================================================

    function render() {
        let data = [...students];

        const search = studentSearch
            ? studentSearch.value.trim().toLowerCase()
            : "";

        const selectedSeries = seriesFilter
            ? seriesFilter.value
            : "";

        const selectedClass = classFilter
            ? classFilter.value
            : "";

        data = data.filter(student => {
            const matchesName =
                student.name.toLowerCase().includes(search);

            const seriesObject = series.find(item =>
                String(item.id) === String(selectedSeries)
            );

            const matchesSeries =
                !selectedSeries ||
                String(student.idSeries) === String(selectedSeries) ||
                (
                    !student.idSeries &&
                    seriesObject &&
                    student.series === seriesObject.name
                );

            const matchesClass =
                !selectedClass ||
                String(student.idClass) === String(selectedClass);

            return matchesName && matchesSeries && matchesClass;
        });

        const studentCount =
            document.getElementById("studentCount");

        if (studentCount) {
            studentCount.textContent =
                `Exibindo ${data.length} de ${students.length} estudantes registrados`;
        }

        studentTable.innerHTML = data.length
            ? data
                .map(student => `
                    <tr>
                        <td>
                            <b>${student.name}</b>
                        </td>

                        <td>
                            ${student.series || "-"}
                        </td>

                        <td>
                            <span class="pill">
                                ${student.className || "-"}
                            </span>
                        </td>

                        <td>
                            ${student.shift || "-"}
                        </td>

                        <td>
                            ${student.active ? "Ativo" : "Inativo"}
                        </td>

                        <td>
                            <button
                                type="button"
                                class="icon-btn edit-link"
                                data-id="${student.id}"
                            >
                                ✎
                            </button>

                            <button
                                type="button"
                                class="icon-btn delete-link"
                                data-id="${student.id}"
                            >
                                ♜
                            </button>
                        </td>
                    </tr>
                `)
                .join("")
            : `
                <tr>
                    <td colspan="6">
                        <div class="empty">
                            Nenhum aluno encontrado.
                        </div>
                    </td>
                </tr>
            `;

        document
            .querySelectorAll(".edit-link")
            .forEach(button => {
                button.onclick = () => {
                    location.href =
                        `edicao.html?student=${button.dataset.id}`;
                };
            });

        document
            .querySelectorAll(".delete-link")
            .forEach(button => {
                button.onclick = async () => {
                    const student = students.find(item =>
                        String(item.id) ===
                        String(button.dataset.id)
                    );

                    if (!student) return;

                    const confirmed = confirm(
                        `Deseja realmente excluir o aluno "${student.name}"?`
                    );

                    if (!confirmed) return;

                    try {
                        await deleteStudentAPI(student.id);
                        await loadData();

                        toast(
                            "Aluno excluído com sucesso."
                        );
                    } catch (error) {
                        console.error(error);
                        toast(error.message);
                    }
                };
            });
    }

    // ========================================================
    // EVENTOS DOS FILTROS
    // ========================================================

    if (studentSeries) {
        studentSeries.onchange =
            updateStudentClassSelect;
    }

    if (seriesFilter) {
        seriesFilter.onchange = () => {
            updateFilters();
            render();
        };
    }

    if (classFilter) {
        classFilter.onchange = render;
    }

    if (studentSearch) {
        studentSearch.oninput = render;
    }

    // ========================================================
    // CADASTRAR ALUNO
    // ========================================================

    if (studentForm) {
        studentForm.onsubmit = async event => {
            event.preventDefault();

            const name = studentName
                ? studentName.value.trim()
                : "";

            const idClass = studentClass
                ? studentClass.value
                : "";

            if (!name) {
                toast("Informe o nome do aluno.");
                return;
            }

            if (!studentSeries || !studentSeries.value) {
                toast("Selecione a série.");
                return;
            }

            if (!idClass) {
                toast("Selecione a turma.");
                return;
            }

            try {
                await createStudentAPI({
                    name,
                    idClass
                });

                studentForm.reset();
                updateStudentClassSelect();

                await loadData();

                toast(
                    "Aluno cadastrado com sucesso."
                );
            } catch (error) {
                console.error(error);
                toast(error.message);
            }
        };
    }

    // ========================================================
    // MODAL DE SÉRIES E TURMAS
    // ========================================================

    if (openManager) {
        openManager.onclick = () => {
            if (modal) {
                modal.style.display = "flex";
            }
        };
    }

    if (closeManager) {
        closeManager.onclick = () => {
            if (modal) {
                modal.style.display = "none";
            }
        };
    }

    if (modal) {
        modal.onclick = event => {
            if (event.target === modal) {
                modal.style.display = "none";
            }
        };
    }

    // ========================================================
    // CADASTRAR SÉRIE
    // ========================================================

    if (saveSeries) {
        saveSeries.onclick = async () => {
            const name = newSeriesName
                ? newSeriesName.value.trim()
                : "";

            if (!name) {
                toast("Informe o nome da série.");
                return;
            }

            try {
                await createSeriesAPI(name);

                if (newSeriesName) {
                    newSeriesName.value = "";
                }

                await loadData();

                toast(
                    "Série cadastrada com sucesso."
                );
            } catch (error) {
                console.error(error);
                toast(error.message);
            }
        };
    }

    // ========================================================
    // CADASTRAR TURMA
    // ========================================================

    if (saveClass) {
        saveClass.onclick = async () => {
            const idSeries = newClassSeries
                ? newClassSeries.value
                : "";

            const name = newClassName
                ? newClassName.value.trim()
                : "";

            const shift = newClassShift
                ? newClassShift.value
                : "";

            if (!idSeries) {
                toast("Selecione a série.");
                return;
            }

            if (!name) {
                toast("Informe o nome da turma.");
                return;
            }

            if (!shift) {
                toast("Selecione o turno.");
                return;
            }

            try {
                await createClassAPI({
                    idSeries,
                    name,
                    shift
                });

                if (newClassName) {
                    newClassName.value = "";
                }

                if (newClassShift) {
                    newClassShift.value = "";
                }

                await loadData();

                toast(
                    "Turma cadastrada com sucesso."
                );
            } catch (error) {
                console.error(error);
                toast(error.message);
            }
        };
    }

    // ========================================================
    // INICIALIZAÇÃO DO CADASTRO
    // ========================================================

    try {
        await loadData();
    } catch (error) {
        console.error(error);

        toast(
            "Não foi possível carregar os dados."
        );
    }
}


// CONSULTA E RELATÓRIOS


async function initReports() {
    const reportTable = document.getElementById("reportTable");

    if (!reportTable) return;

    let students = [];
    let records = [];

    // CARREGAR ALUNOS
    try {
        students = await getStudentsFromAPI();
    } catch (error) {
        console.error(error);
        toast("Não foi possível carregar os alunos.");
        return;
    }

    // CARREGAR PRESENÇAS
    try {
        const response = await fetch(`${API_URL}/api/presencas`);

        if (!response.ok)
            throw new Error("Não foi possível carregar as presenças.");

        const data = await response.json();

        records = data.map(item => ({
            id: String(item.idPresenca),
            studentId: String(item.idAluno),
            date: item.dataAula ? String(item.dataAula).substring(0, 10) : "",
            theme: item.conteudo || "",
            present: item.situacao === "Presente",
            situation: item.situacao,
            idClass: item.idTurma === null || item.idTurma === undefined
                ? null
                : String(item.idTurma),
            className: item.turma || "",
            series: item.serie || "",
            shift: item.turno || ""
        }));
    } catch (error) {
        console.error(error);
        toast("Não foi possível carregar as presenças.");
        return;
    }

    // ELEMENTOS
    populateSelect("filterTheme", [ALL_THEMES, ...THEMES], true);

    const filterName = document.getElementById("filterName");
    const filterDate = document.getElementById("filterDate");
    const filterTheme = document.getElementById("filterTheme");
    const filterDay = document.getElementById("filterDay");

    const rTotal = document.getElementById("rTotal");
    const rPresent = document.getElementById("rPresent");
    const rAbsent = document.getElementById("rAbsent");
    const rRate = document.getElementById("rRate");
    const rBar = document.getElementById("rBar");

    const deleteAllRecords = document.getElementById("deleteAllRecords");

    if (filterTheme)
        filterTheme.value = ALL_THEMES;

    // FILTRAGEM
    function getFilteredRows() {
        const name = filterName
            ? filterName.value.trim().toLowerCase()
            : "";

        const date = filterDate
            ? normalizeDate(filterDate.value)
            : "";

        const theme = filterTheme
            ? filterTheme.value
            : "";

        const day = filterDay
            ? filterDay.value
            : "";

        const activeStatusButton =
            document.querySelector(".status-filter button.active");

        const status = activeStatusButton
            ? activeStatusButton.dataset.status
            : "";

        return records
            .map(record => {
                const student = students.find(item =>
                    String(item.id) === String(record.studentId)
                );

                return {
                    ...record,
                    student
                };
            })
            .filter(record => {
                const studentName = record.student?.name || "";

                const matchesName =
                    !name ||
                    studentName.toLowerCase().includes(name);

                const matchesDate =
                    !date ||
                    normalizeDate(record.date) === date;

                const matchesTheme =
                    !theme ||
                    theme === ALL_THEMES ||
                    record.theme === theme;

                const matchesDay =
                    !day ||
                    getWeekDay(record.date) === day;

                const matchesStatus =
                    !status ||
                    (status === "present" && record.present) ||
                    (status === "absent" && !record.present);

                return (
                    matchesName &&
                    matchesDate &&
                    matchesTheme &&
                    matchesDay &&
                    matchesStatus
                );
            })
            .sort((a, b) => {
                const dateComparison =
                    normalizeDate(b.date).localeCompare(
                        normalizeDate(a.date)
                    );

                if (dateComparison !== 0)
                    return dateComparison;

                return (a.student?.name || "").localeCompare(
                    b.student?.name || ""
                );
            });
    }

    // RESUMO
    function updateSummary(rows) {
        const total = rows.length;

        const present = rows.filter(
            record => record.present
        ).length;

        const absent = total - present;

        const rate = total
            ? Math.round((present / total) * 100)
            : 0;

        if (rTotal)
            rTotal.textContent = total;

        if (rPresent)
            rPresent.textContent = present;

        if (rAbsent)
            rAbsent.textContent = absent;

        if (rRate)
            rRate.textContent = `${rate}%`;

        if (rBar)
            rBar.style.width = `${rate}%`;
    }

    // EXIBIR RELATÓRIO
    function render() {
        const rows = getFilteredRows();

        updateSummary(rows);

        if (!rows.length) {
            reportTable.innerHTML = `
                <tr>
                    <td colspan="5">
                        <div class="empty">
                            Nenhum registro encontrado.
                        </div>
                    </td>
                </tr>
            `;

            return;
        }

        reportTable.innerHTML = rows
            .map(record => {
                const student = record.student;

                const studentName =
                    student?.name || "Aluno não encontrado";

                const series =
                    record.series ||
                    student?.series ||
                    "";

                const className =
                    record.className ||
                    student?.className ||
                    "";

                const shift =
                    record.shift ||
                    student?.shift ||
                    "";

                const studentInfo = [
                    series,
                    className,
                    shift
                ]
                    .filter(Boolean)
                    .join(" • ");

                return `
                    <tr>
                        <td>
                            <b>${studentName}</b>

                            ${
                                studentInfo
                                    ? `
                                        <small class="report-student-meta">
                                            ${studentInfo}
                                        </small>
                                    `
                                    : ""
                            }
                        </td>

                        <td>
                            ${formatDate(record.date)}
                        </td>

                        <td>
                            ${record.theme || "-"}
                        </td>

                        <td>
                            <b class="${
                                record.present
                                    ? "status-present"
                                    : "status-absent"
                            }">
                                ${
                                    record.present
                                        ? "Presente"
                                        : "Ausente"
                                }
                            </b>
                        </td>

                        <td>
                            <button
                                type="button"
                                class="icon-btn report-edit"
                                data-id="${record.id}"
                                title="Editar registro"
                            >
                                ✎
                            </button>
                        </td>
                    </tr>
                `;
            })
            .join("");

        reportTable
            .querySelectorAll(".report-edit")
            .forEach(button => {
                button.onclick = () => {
                    location.href =
                        `edicao.html?record=${button.dataset.id}`;
                };
            });
    }

    // EVENTOS DOS FILTROS
    if (filterName)
        filterName.oninput = render;

    if (filterDate)
        filterDate.onchange = render;

    if (filterTheme)
        filterTheme.onchange = render;

    if (filterDay)
        filterDay.onchange = render;

    document
        .querySelectorAll(".status-filter button")
        .forEach(button => {
            button.onclick = () => {
                document
                    .querySelectorAll(".status-filter button")
                    .forEach(item => {
                        item.classList.remove("active");
                    });

                button.classList.add("active");
                render();
            };
        });

    // EXCLUIR TODOS OS REGISTROS
    if (deleteAllRecords) {
        deleteAllRecords.onclick = async () => {
            if (!records.length) {
                toast("Não há registros de presença para excluir.");
                return;
            }

            const confirmar = confirm(
                `Tem certeza que deseja excluir TODOS os ${records.length} registros de presença?\n\nEsta ação não poderá ser desfeita.`
            );

            if (!confirmar) return;

            try {
                deleteAllRecords.disabled = true;

                const response = await fetch(`${API_URL}/api/presencas`, {
                    method: "DELETE"
                });

                const result = await response.json();

                if (!response.ok)
                    throw new Error(
                        result.mensagem ||
                        "Não foi possível excluir os registros."
                    );

                records = [];
                render();

                toast(
                    result.quantidade === 1
                        ? "1 registro de presença excluído."
                        : `${result.quantidade} registros de presença excluídos.`
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Não foi possível excluir os registros."
                );
            } finally {
                deleteAllRecords.disabled = false;
            }
        };
    }

    // EXPORTAR CSV
    const exportCsv =
        document.getElementById("exportCsv");

    if (exportCsv) {
        exportCsv.onclick = () => {
            const rows = getFilteredRows();

            const csv =
                "Aluno,Série,Turma,Turno,Data,Tema,Status\n" +
                rows
                    .map(record =>
                        `"${record.student?.name || ""}",` +
                        `"${record.student?.series || record.series || ""}",` +
                        `"${record.student?.className || record.className || ""}",` +
                        `"${record.student?.shift || record.shift || ""}",` +
                        `"${formatDate(record.date)}",` +
                        `"${record.theme}",` +
                        `"${record.present ? "Presente" : "Ausente"}"`
                    )
                    .join("\n");

            const blob = new Blob(
                ["\uFEFF" + csv],
                {
                    type: "text/csv;charset=utf-8"
                }
            );

            const link =
                document.createElement("a");

            link.href =
                URL.createObjectURL(blob);

            link.download =
                "relatorio-frequencia.csv";

            link.click();

            URL.revokeObjectURL(link.href);
        };
    }

    // EXIBIÇÃO INICIAL
    render();
}


// EDIÇÃO DE DADOS


async function initEdit() {
    const studentSelect = document.getElementById("editStudentSelect");
    if (!studentSelect) return;

    const studentSearch = document.getElementById("editStudentSearch");
    const studentResults = document.getElementById("editStudentResults");

    const editName = document.getElementById("editName");
    const editSeries = document.getElementById("editSeries");
    const editClass = document.getElementById("editClass");
    const editShift = document.getElementById("editShift");
    const editStudentForm = document.getElementById("editStudentForm");
    const deleteStudent = document.getElementById("deleteStudent");
    const cancelStudent = document.getElementById("cancelStudent");

    const tabStudents = document.getElementById("tabStudents");
    const tabRecords = document.getElementById("tabRecords");
    const editStudentSection = document.getElementById("editStudentSection");
    const editRecordSection = document.getElementById("editRecordSection");

    const recordStudentSearch = document.getElementById("recordStudentSearch");
    const recordStudentResults = document.getElementById("recordStudentResults");
    const recordStudentId = document.getElementById("recordStudentId");
    const recordSelect = document.getElementById("recordSelect");
    const recordStudent = document.getElementById("recordStudent");
    const recordDate = document.getElementById("recordDate");
    const recordTheme = document.getElementById("recordTheme");
    const recordPresent = document.getElementById("recordPresent");
    const recordAbsent = document.getElementById("recordAbsent");
    const saveRecord = document.getElementById("saveRecord");
    const deleteRecord = document.getElementById("deleteRecord");
    const cancelRecord = document.getElementById("cancelRecord");

    let students = [];
    let series = [];
    let classes = [];
    let records = [];

    const params = new URLSearchParams(location.search);

    if (recordTheme) {
        populateSelect("recordTheme", THEMES, false);
    }

    // ========================================================
    // API - REGISTROS DE PRESENÇA
    // ========================================================

    async function getPresenceRecordsFromAPI() {
        const response = await fetch(`${API_URL}/api/presencas`);

        if (!response.ok) {
            throw new Error(
                "Não foi possível carregar os registros de presença."
            );
        }

        const data = await response.json();

        return data.map(item => ({
            id: String(item.idPresenca),
            studentId: String(item.idAluno),

            date: item.dataAula
                ? String(item.dataAula).substring(0, 10)
                : "",

            theme: item.conteudo || "",
            present: item.situacao === "Presente",
            situation: item.situacao,

            idClass:
                item.idTurma === null || item.idTurma === undefined
                    ? null
                    : String(item.idTurma),

            className: item.turma || "",

            idSeries:
                item.idSerie === null || item.idSerie === undefined
                    ? null
                    : String(item.idSerie),

            series: item.serie || "",
            shift: item.turno || ""
        }));
    }

    async function updatePresenceAPI(id, data) {
        const response = await fetch(
            `${API_URL}/api/presencas/${id}`,
            {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    data: data.date,
                    conteudo: data.theme,
                    presente: data.present
                })
            }
        );

        if (!response.ok) {
            let message =
                "Não foi possível atualizar o registro.";

            try {
                const error = await response.json();

                if (error.mensagem) {
                    message = error.mensagem;
                }
            } catch {
                // Mantém a mensagem padrão.
            }

            throw new Error(message);
        }

        if (response.status === 204) {
            return null;
        }

        const text = await response.text();

        if (!text) {
            return null;
        }

        try {
            return JSON.parse(text);
        } catch {
            return null;
        }
    }

    async function deletePresenceAPI(id) {
        const response = await fetch(
            `${API_URL}/api/presencas/${id}`,
            {
                method: "DELETE"
            }
        );

        if (!response.ok) {
            let message =
                "Não foi possível excluir o registro.";

            try {
                const error = await response.json();

                if (error.mensagem) {
                    message = error.mensagem;
                }
            } catch {
                // Mantém a mensagem padrão.
            }

            throw new Error(message);
        }

        return true;
    }

    // ========================================================
    // CARREGAR DADOS
    // ========================================================

    try {
        const result = await Promise.all([
            getStudentsFromAPI(),
            getSeriesFromAPI(),
            getClassesFromAPI(),
            getPresenceRecordsFromAPI()
        ]);

        students = result[0];

        series = result[1].filter(
            item => item.active
        );

        classes = result[2].filter(
            item => item.active
        );

        records = result[3];
    } catch (error) {
        console.error(error);

        toast(
            "Não foi possível carregar os dados."
        );

        return;
    }

    async function reloadPresenceRecords() {
        records =
            await getPresenceRecordsFromAPI();
    }

    // ========================================================
    // INFORMAÇÕES DO ALUNO
    // ========================================================

    function getStudentDescription(student) {
        const information = [];

        if (student.series) {
            information.push(student.series);
        }

        if (
            student.className &&
            student.className !== student.series
        ) {
            information.push(student.className);
        }

        if (student.shift) {
            information.push(student.shift);
        }

        return information.join(" • ");
    }

    // ========================================================
    // BUSCA E EDIÇÃO DO ALUNO
    // ========================================================

    function refreshStudentSelect(selectedId = null) {
        studentSelect.value = selectedId
            ? String(selectedId)
            : "";

        if (!studentSearch) return;

        if (!selectedId) {
            studentSearch.value = "";

            studentSearch.classList.remove(
                "student-selected"
            );

            return;
        }

        const student = students.find(item =>
            String(item.id) === String(selectedId)
        );

        if (!student) {
            studentSelect.value = "";
            studentSearch.value = "";

            studentSearch.classList.remove(
                "student-selected"
            );

            return;
        }

        studentSearch.value = student.name;

        studentSearch.classList.add(
            "student-selected"
        );
    }

    function renderStudentSearchResults() {
        if (!studentSearch || !studentResults) {
            return;
        }

        const search =
            studentSearch.value
                .trim()
                .toLowerCase();

        if (!search) {
            studentResults.innerHTML = "";
            studentResults.classList.remove("show");
            return;
        }

        const matches = students
            .filter(student =>
                student.name
                    .toLowerCase()
                    .includes(search)
            )
            .slice(0, 10);

        if (!matches.length) {
            studentResults.innerHTML = `
                <div class="student-search-empty">
                    Nenhum aluno encontrado.
                </div>
            `;

            studentResults.classList.add("show");
            return;
        }

        studentResults.innerHTML = matches
            .map(student => `
                <button
                    type="button"
                    class="student-search-item"
                    data-edit-student="${student.id}"
                >
                    <div class="student-search-avatar">
                        ${initials(student.name)}
                    </div>

                    <div class="student-search-info">
                        <b>${student.name}</b>
                        <small>
                            ${getStudentDescription(student)}
                        </small>
                    </div>
                </button>
            `)
            .join("");

        studentResults.classList.add("show");

        studentResults
            .querySelectorAll("[data-edit-student]")
            .forEach(button => {
                button.onclick = () => {
                    const id =
                        button.dataset.editStudent;

                    refreshStudentSelect(id);

                    studentResults.innerHTML = "";
                    studentResults.classList.remove("show");

                    fillStudent();
                };
            });
    }

    if (studentSearch) {
        studentSearch.oninput = () => {
            studentSelect.value = "";

            studentSearch.classList.remove(
                "student-selected"
            );

            if (editName) {
                editName.value = "";
            }

            if (editSeries) {
                editSeries.value = "";
            }

            refreshClassSelect("");
            renderStudentSearchResults();
        };

        studentSearch.onfocus = () => {
            if (
                studentSearch.value &&
                !studentSelect.value
            ) {
                renderStudentSearchResults();
            }
        };
    }

    // ========================================================
    // SÉRIES E TURMAS
    // ========================================================

    function refreshSeriesSelect() {
        if (!editSeries) return;

        editSeries.innerHTML = `
            <option value="">
                Selecione a série...
            </option>
        `;

        series.forEach(item => {
            const option =
                document.createElement("option");

            option.value = item.id;
            option.textContent = item.name;

            editSeries.appendChild(option);
        });
    }

    function refreshClassSelect(
        idSeries,
        selectedClass = null
    ) {
        if (!editClass) return;

        editClass.innerHTML = "";

        if (!idSeries) {
            editClass.innerHTML = `
                <option value="">
                    Selecione primeiro a série...
                </option>
            `;

            editClass.disabled = true;

            if (editShift) {
                editShift.value = "";
            }

            return;
        }

        const filteredClasses =
            classes.filter(item =>
                String(item.idSeries) ===
                String(idSeries)
            );

        editClass.disabled = false;

        editClass.innerHTML = `
            <option value="">
                Selecione a turma...
            </option>
        `;

        filteredClasses.forEach(item => {
            const option =
                document.createElement("option");

            option.value = item.id;
            option.textContent = item.name;

            editClass.appendChild(option);
        });

        if (
            selectedClass &&
            filteredClasses.some(item =>
                String(item.id) ===
                String(selectedClass)
            )
        ) {
            editClass.value =
                String(selectedClass);
        }

        updateShift();
    }

    function updateShift() {
        if (!editClass || !editShift) {
            return;
        }

        const selectedClass =
            classes.find(item =>
                String(item.id) ===
                String(editClass.value)
            );

        editShift.value = selectedClass
            ? selectedClass.shift
            : "";
    }

    function fillStudent() {
        const student = students.find(item =>
            String(item.id) ===
            String(studentSelect.value)
        );

        if (!student) {
            if (editName) {
                editName.value = "";
            }

            if (editSeries) {
                editSeries.value = "";
            }

            refreshClassSelect("");
            return;
        }

        if (editName) {
            editName.value =
                student.name || "";
        }

        if (editSeries) {
            editSeries.value =
                student.idSeries
                    ? String(student.idSeries)
                    : "";
        }

        refreshClassSelect(
            student.idSeries,
            student.idClass
        );
    }

    // ========================================================
    // CARREGAMENTO INICIAL DO ALUNO
    // ========================================================

    refreshStudentSelect();
    refreshSeriesSelect();

    const requestedStudent =
        params.get("student");

    if (
        requestedStudent &&
        students.some(student =>
            String(student.id) ===
            String(requestedStudent)
        )
    ) {
        refreshStudentSelect(requestedStudent);
        fillStudent();
    } else {
        studentSelect.value = "";

        if (studentSearch) {
            studentSearch.value = "";
        }

        if (editName) {
            editName.value = "";
        }

        if (editSeries) {
            editSeries.value = "";
        }

        refreshClassSelect("");
    }

    if (editSeries) {
        editSeries.onchange = () => {
            refreshClassSelect(
                editSeries.value
            );
        };
    }

    if (editClass) {
        editClass.onchange = updateShift;
    }

    // ========================================================
    // SALVAR ALTERAÇÕES DO ALUNO
    // ========================================================

    if (editStudentForm) {
        editStudentForm.onsubmit = async event => {
            event.preventDefault();

            const id = studentSelect.value;

            const name = editName
                ? editName.value.trim()
                : "";

            const idSeries = editSeries
                ? editSeries.value
                : "";

            const idClass = editClass
                ? editClass.value
                : "";

            if (!id) {
                toast("Selecione um aluno.");
                return;
            }

            if (!name) {
                toast("Informe o nome do aluno.");
                return;
            }

            if (!idSeries) {
                toast("Selecione a série.");
                return;
            }

            if (!idClass) {
                toast("Selecione a turma.");
                return;
            }

            const submitButton =
                editStudentForm.querySelector(
                    'button[type="submit"]'
                );

            if (submitButton) {
                submitButton.disabled = true;
            }

            try {
                await updateStudentAPI(id, {
                    name,
                    idClass: Number(idClass)
                });

                students =
                    await getStudentsFromAPI();

                refreshStudentSelect(id);
                fillStudent();

                toast(
                    "Aluno atualizado com sucesso."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Erro ao atualizar aluno."
                );
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                }
            }
        };
    }

    // ========================================================
    // EXCLUIR ALUNO
    // ========================================================

    if (deleteStudent) {
        deleteStudent.onclick = async () => {
            const id = studentSelect.value;

            const student = students.find(item =>
                String(item.id) === String(id)
            );

            if (!student) {
                toast("Selecione um aluno.");
                return;
            }

            const confirmed = confirm(
                `Deseja realmente excluir o aluno "${student.name}"?\n\nEsta ação também excluirá matrículas e presenças vinculadas a ele.`
            );

            if (!confirmed) return;

            try {
                await deleteStudentAPI(id);

                toast(
                    "Aluno excluído com sucesso."
                );

                setTimeout(() => {
                    location.href = "alunos.html";
                }, 500);
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Erro ao excluir aluno."
                );
            }
        };
    }

    if (cancelStudent) {
        cancelStudent.onclick = () => {
            location.href = "alunos.html";
        };
    }

    // ========================================================
    // BUSCA DO ALUNO PARA REGISTROS DE PRESENÇA
    // ========================================================

    function renderRecordStudentResults() {
        if (
            !recordStudentSearch ||
            !recordStudentResults
        ) {
            return;
        }

        const search =
            recordStudentSearch.value
                .trim()
                .toLowerCase();

        if (!search) {
            recordStudentResults.innerHTML = "";
            recordStudentResults.classList.remove("show");
            return;
        }

        const matches = students
            .filter(student =>
                student.name
                    .toLowerCase()
                    .includes(search)
            )
            .slice(0, 10);

        if (!matches.length) {
            recordStudentResults.innerHTML = `
                <div class="student-search-empty">
                    Nenhum aluno encontrado.
                </div>
            `;

            recordStudentResults.classList.add("show");
            return;
        }

        recordStudentResults.innerHTML = matches
            .map(student => `
                <button
                    type="button"
                    class="student-search-item"
                    data-record-student="${student.id}"
                >
                    <div class="student-search-avatar">
                        ${initials(student.name)}
                    </div>

                    <div class="student-search-info">
                        <b>${student.name}</b>
                        <small>
                            ${getStudentDescription(student)}
                        </small>
                    </div>
                </button>
            `)
            .join("");

        recordStudentResults.classList.add("show");

        recordStudentResults
            .querySelectorAll("[data-record-student]")
            .forEach(button => {
                button.onclick = () => {
                    const id =
                        button.dataset.recordStudent;

                    const student =
                        students.find(item =>
                            String(item.id) ===
                            String(id)
                        );

                    if (!student) return;

                    if (recordStudentId) {
                        recordStudentId.value =
                            String(student.id);
                    }

                    recordStudentSearch.value =
                        student.name;

                    recordStudentSearch.classList.add(
                        "student-selected"
                    );

                    recordStudentResults.innerHTML = "";

                    recordStudentResults.classList.remove(
                        "show"
                    );

                    refreshRecords(student.id);
                };
            });
    }

    if (recordStudentSearch) {
        recordStudentSearch.oninput = () => {
            if (recordStudentId) {
                recordStudentId.value = "";
            }

            recordStudentSearch.classList.remove(
                "student-selected"
            );

            if (recordSelect) {
                recordSelect.innerHTML = `
                    <option value="">
                        Selecione primeiro um aluno...
                    </option>
                `;

                recordSelect.disabled = true;
            }

            fillRecord();
            renderRecordStudentResults();
        };

        recordStudentSearch.onfocus = () => {
            if (
                recordStudentSearch.value &&
                recordStudentId &&
                !recordStudentId.value
            ) {
                renderRecordStudentResults();
            }
        };
    }

    // ========================================================
    // REGISTROS DO ALUNO
    // ========================================================

    function refreshRecords(
        studentId = null,
        selectedRecordId = null
    ) {
        if (!recordSelect) return;

        if (!studentId) {
            studentId = recordStudentId
                ? recordStudentId.value
                : "";
        }

        if (!studentId) {
            recordSelect.innerHTML = `
                <option value="">
                    Selecione primeiro um aluno...
                </option>
            `;

            recordSelect.disabled = true;

            fillRecord();
            return;
        }

        const studentRecords = records
            .filter(record =>
                String(record.studentId) ===
                String(studentId)
            )
            .sort((a, b) =>
                normalizeDate(b.date)
                    .localeCompare(
                        normalizeDate(a.date)
                    )
            );

        if (!studentRecords.length) {
            recordSelect.innerHTML = `
                <option value="">
                    Nenhum registro encontrado para este aluno
                </option>
            `;

            recordSelect.disabled = true;

            fillRecord();
            return;
        }

        recordSelect.disabled = false;

        recordSelect.innerHTML = `
            <option value="">
                Selecione um registro...
            </option>
        `;

        studentRecords.forEach(record => {
            const option =
                document.createElement("option");

            option.value = record.id;

            const theme = record.theme
                ? record.theme.replace(
                    /^\d+\.\s*/,
                    ""
                )
                : "Sem tema";

            option.textContent =
                `${formatDate(record.date)} | ` +
                `${theme} | ` +
                `${record.present ? "PRESENTE" : "AUSENTE"}`;

            recordSelect.appendChild(option);
        });

        if (
            selectedRecordId &&
            studentRecords.some(record =>
                String(record.id) ===
                String(selectedRecordId)
            )
        ) {
            recordSelect.value =
                String(selectedRecordId);
        }

        fillRecord();
    }

    // ========================================================
    // PREENCHER REGISTRO
    // ========================================================

    function fillRecord() {
        if (!recordSelect) return;

        const record = records.find(item =>
            String(item.id) ===
            String(recordSelect.value)
        );

        if (!record) {
            if (recordStudent) {
                recordStudent.value = "";
            }

            if (recordDate) {
                recordDate.value = "";
            }

            if (recordTheme) {
                recordTheme.value = "";
            }

            if (recordPresent) {
                recordPresent.classList.remove(
                    "active-present"
                );
            }

            if (recordAbsent) {
                recordAbsent.classList.remove(
                    "active-absent"
                );
            }

            return;
        }

        const student = students.find(item =>
            String(item.id) ===
            String(record.studentId)
        );

        if (recordStudent) {
            recordStudent.value =
                student?.name || "";
        }

        if (recordDate) {
            recordDate.value =
                normalizeDate(record.date);
        }

        if (recordTheme) {
            recordTheme.value =
                record.theme || "";
        }

        if (recordPresent) {
            recordPresent.classList.toggle(
                "active-present",
                record.present === true
            );
        }

        if (recordAbsent) {
            recordAbsent.classList.toggle(
                "active-absent",
                record.present === false
            );
        }
    }

    // ========================================================
    // ABAS
    // ========================================================

    if (tabStudents) {
        tabStudents.onclick = () => {
            if (editStudentSection) {
                editStudentSection.style.display =
                    "block";
            }

            if (editRecordSection) {
                editRecordSection.style.display =
                    "none";
            }

            tabStudents.classList.add("active");

            if (tabRecords) {
                tabRecords.classList.remove("active");
            }
        };
    }

    if (tabRecords) {
        tabRecords.onclick = () => {
            if (editStudentSection) {
                editStudentSection.style.display =
                    "none";
            }

            if (editRecordSection) {
                editRecordSection.style.display =
                    "block";
            }

            tabRecords.classList.add("active");

            if (tabStudents) {
                tabStudents.classList.remove("active");
            }

            refreshRecords();
        };
    }

    if (recordSelect) {
        recordSelect.onchange = fillRecord;
    }

    // ========================================================
    // PRESENTE / AUSENTE
    // ========================================================

    if (recordPresent) {
        recordPresent.onclick = () => {
            if (!recordSelect) return;

            const record = records.find(item =>
                String(item.id) ===
                String(recordSelect.value)
            );

            if (!record) return;

            record.present = true;
            fillRecord();
        };
    }

    if (recordAbsent) {
        recordAbsent.onclick = () => {
            if (!recordSelect) return;

            const record = records.find(item =>
                String(item.id) ===
                String(recordSelect.value)
            );

            if (!record) return;

            record.present = false;
            fillRecord();
        };
    }

    // ========================================================
    // SALVAR REGISTRO
    // ========================================================

    if (saveRecord) {
        saveRecord.onclick = async () => {
            if (!recordSelect) return;

            const record = records.find(item =>
                String(item.id) ===
                String(recordSelect.value)
            );

            if (!record) {
                toast(
                    "Nenhum registro selecionado."
                );

                return;
            }

            if (!recordDate || !recordDate.value) {
                toast("Informe a data da aula.");
                return;
            }

            if (!recordTheme || !recordTheme.value) {
                toast("Selecione o tema da aula.");
                return;
            }

            const currentId = record.id;
            const studentId = record.studentId;

            const updatedData = {
                date: normalizeDate(
                    recordDate.value
                ),

                theme: recordTheme.value,
                present: record.present
            };

            saveRecord.disabled = true;

            try {
                await updatePresenceAPI(
                    currentId,
                    updatedData
                );

                await reloadPresenceRecords();

                refreshRecords(
                    studentId,
                    currentId
                );

                toast(
                    "Registro atualizado com sucesso."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Erro ao atualizar registro."
                );

                try {
                    await reloadPresenceRecords();

                    refreshRecords(
                        studentId,
                        currentId
                    );
                } catch {
                    // Mantém a tela atual.
                }
            } finally {
                saveRecord.disabled = false;
            }
        };
    }

    // ========================================================
    // EXCLUIR REGISTRO
    // ========================================================

    if (deleteRecord) {
        deleteRecord.onclick = async () => {
            if (!recordSelect) return;

            const id = recordSelect.value;

            if (!id) {
                toast(
                    "Nenhum registro selecionado."
                );

                return;
            }

            const record = records.find(item =>
                String(item.id) === String(id)
            );

            if (!record) {
                toast("Registro não encontrado.");
                return;
            }

            const studentId = record.studentId;

            const confirmed = confirm(
                "Deseja realmente excluir este registro?"
            );

            if (!confirmed) return;

            deleteRecord.disabled = true;

            try {
                await deletePresenceAPI(id);

                await reloadPresenceRecords();

                refreshRecords(studentId);

                toast(
                    "Registro excluído com sucesso."
                );
            } catch (error) {
                console.error(error);

                toast(
                    error.message ||
                    "Erro ao excluir registro."
                );
            } finally {
                deleteRecord.disabled = false;
            }
        };
    }

    if (cancelRecord) {
        cancelRecord.onclick = () => {
            location.href = "relatorios.html";
        };
    }

    // ========================================================
    // FECHAR RESULTADOS DA BUSCA AO CLICAR FORA
    // ========================================================

    document.addEventListener("click", event => {
        if (
            studentResults &&
            studentSearch &&
            !studentResults.contains(event.target) &&
            event.target !== studentSearch
        ) {
            studentResults.classList.remove("show");
        }

        if (
            recordStudentResults &&
            recordStudentSearch &&
            !recordStudentResults.contains(event.target) &&
            event.target !== recordStudentSearch
        ) {
            recordStudentResults.classList.remove("show");
        }
    });

    // ========================================================
    // ABRIR REGISTRO DIRETAMENTE PELO RELATÓRIO
    // ========================================================

    const requestedRecord =
        params.get("record");

    if (
        requestedRecord &&
        tabRecords
    ) {
        const record = records.find(item =>
            String(item.id) ===
            String(requestedRecord)
        );

        if (record) {
            const student = students.find(item =>
                String(item.id) ===
                String(record.studentId)
            );

            tabRecords.click();

            if (
                student &&
                recordStudentId &&
                recordStudentSearch
            ) {
                recordStudentId.value =
                    String(student.id);

                recordStudentSearch.value =
                    student.name;

                recordStudentSearch.classList.add(
                    "student-selected"
                );

                refreshRecords(
                    student.id,
                    requestedRecord
                );
            }
        } else {
            toast(
                "Registro de presença não encontrado."
            );
        }
    } else {
        if (recordStudentId) {
            recordStudentId.value = "";
        }

        if (recordStudentSearch) {
            recordStudentSearch.value = "";

            recordStudentSearch.classList.remove(
                "student-selected"
            );
        }

        refreshRecords();
    }
}



// INICIALIZAÇÃO


setupCommon();
initCall();
initStudents();
initReports();
initEdit();