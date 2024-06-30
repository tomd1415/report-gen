document.addEventListener('DOMContentLoaded', function() {
    loadYearGroups();
    loadSubjects();
});

function loadYearGroups() {
    // Mock data and element creation for demonstration
    const yearGroups = ['Year 1', 'Year 2', 'Year 3']; // Replace with fetch call to server
    const container = document.getElementById('year-groups-container');
    yearGroups.forEach(group => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = group;
        checkbox.name = 'yearGroup';
        checkbox.value = group;

        const label = document.createElement('label');
        label.htmlFor = group;
        label.textContent = group;

        container.appendChild(checkbox);
        container.appendChild(label);
    });
}

function loadSubjects() {
    const subjects = ['Math', 'Science', 'English']; // Replace with fetch call to server
    const container = document.getElementById('subjects-container');
    subjects.forEach(subject => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = subject;
        checkbox.name = 'subject';
        checkbox.value = subject;

        const label = document.createElement('label');
        label.htmlFor = subject;
        label.textContent = subject;

        container.appendChild(checkbox);
        container.appendChild(label);
    });
}

function changePassword() {
    const newPassword = document.getElementById('new-password').value;
    // Implement the fetch API to send the new password to the server
    console.log('Password would be changed to:', newPassword); // Implement server call
}

