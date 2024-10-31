'use strict';

module.exports = {
    // Create the group 'Estudiantes' by default
    name: 'Creating Estudiantes group',
    timestamp: Date.UTC(2024, 10, 28), 
    method: async function () {
        const groups = require('../../groups');
        const exists = await groups.exists('Estudiantes');
        if (exists) {
            return;
        }
        await groups.create({
            name: 'Estudiantes',
            userTitle: 'Estudiantes',
            description: 'Grupo para Estudiantes',
            hidden: 0,
            private: 1,
            disableJoinRequests: 1,
        });
        await groups.show('Estudiantes');
    },
};