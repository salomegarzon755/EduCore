document.addEventListener('DOMContentLoaded', () => {
    // Intentar obtener el usuario guardado tras el login en la BD
    const storedUserRaw = localStorage.getItem('currentUser');
    let studentFullName = localStorage.getItem('studentName') || '';

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
        // HU.33: el grado y el grupo reales los completa js/familiaResumen.js con datos de la API
        familyStudentDetails.textContent = studentFullName;
    }
});