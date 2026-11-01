document.addEventListener('DOMContentLoaded', () => {
    // Cargar el usuario del estudiante guardado en localStorage
    const savedStudent = localStorage.getItem('studentUser') || 'Sara';
    
    const familyStudentName = document.getElementById('familyStudentName');
    const familyStudentDetails = document.getElementById('familyStudentDetails');

    if (familyStudentName) {
        familyStudentName.textContent = savedStudent;
    }
    
    if (familyStudentDetails) {
        familyStudentDetails.textContent = `${savedStudent} Mosquera · Primero`;
    }
});