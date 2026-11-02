document.addEventListener('DOMContentLoaded', () => {
    // Intentar obtener el usuario guardado tras el login en la BD
    const storedUserRaw = localStorage.getItem('currentUser');
    let studentFullName = localStorage.getItem('studentName') || 'Juan Esteban';

    if (storedUserRaw) {
        try {
            const userObj = JSON.parse(storedUserRaw);
            if (userObj.nombre) {
                studentFullName = userObj.nombre;
            }
        } catch (e) {
            console.error('Error parseando currentUser:', e);
        }
    }

    // Tomar solo el primer nombre para el saludo ("Así aprende Juan")
    const firstName = studentFullName.split(' ')[0];

    const familyStudentName = document.getElementById('familyStudentName');
    const familyStudentDetails = document.getElementById('familyStudentDetails');

    if (familyStudentName) {
        familyStudentName.textContent = firstName;
    }
    
    if (familyStudentDetails) {
        familyStudentDetails.textContent = `${studentFullName} · Primero`;
    }
});