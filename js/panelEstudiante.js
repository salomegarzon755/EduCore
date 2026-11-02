document.addEventListener('DOMContentLoaded', () => {
    
    // Cargar información real del usuario autenticado en PostgreSQL desde localStorage
    const storedUserRaw = localStorage.getItem('currentUser');
    let studentFullName = localStorage.getItem('loggedUserName') || 'Luna';

    if (storedUserRaw) {
        try {
            const userObj = JSON.parse(storedUserRaw);
            if (userObj.nombre) {
                studentFullName = userObj.nombre;
            }
        } catch (e) {
            console.error('Error procesando datos del usuario:', e);
        }
    }

    const firstName = studentFullName.split(' ')[0];

    const displayStudentName = document.getElementById('displayStudentName');
    const studentFirstNameLabels = document.querySelectorAll('.student-first-name');

    if (displayStudentName) displayStudentName.textContent = firstName;
    studentFirstNameLabels.forEach(el => el.textContent = firstName);

});