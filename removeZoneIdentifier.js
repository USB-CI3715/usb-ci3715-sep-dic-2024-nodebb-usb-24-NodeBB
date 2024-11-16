'use strict';

/*
	*******************************************************************************
	************************  Universidad Simon Bolivar  **************************
	*********  Departamento de Computacion y Tecnologia de la Informacion  ********
	*                                                                             *
	* - Trimestre: Septiembre-Diciembre 2024                                      *
	* - Materia: Ingenieria de Software 1                                         *
	* - Profesor: Eduardo Feo Flushing                                            *
	*                                                                             *
	* - Author: Junior Lara (17-10303)                                            *
	*                                                                             *
	* Proyecto 2B: Primer Sprint                                                  *
	*                                                                             *
	*******************************************************************************
*/

const fs = require('fs');
const path = require('path');

let count = 0;

function removeZoneIdentifierFiles(directory) {
	fs.readdir(directory, { withFileTypes: true }, (err, files) => {
		if (err) {
			console.error(`Error al leer el directorio ${directory}: ${err}`);
			return;
		}

		files.forEach((file) => {
			const filePath = path.join(directory, file.name);

			if (file.isDirectory()) {
				// Llama a la función recursivamente para los subdirectorios.
				removeZoneIdentifierFiles(filePath);
			} else if (file.name.endsWith(':Zone.Identifier')) {
				fs.unlink(filePath, (err) => {
					if (err) {
						console.error(`Error al eliminar ${filePath}: ${err}`);
					} else {
						console.log(`Eliminado: ${filePath}`);
						count += 1;
					}
				});
			}
		});
	});
}

// Llama a la función en el directorio actual (raíz del proyecto).
removeZoneIdentifierFiles(process.cwd());

// Escucha cuando el proceso termina para mostrar el total de archivos eliminados.
process.on('exit', () => {
	if (count > 0) {
		console.log(`\nTotal de archivos eliminados: ${count}`);
	} else {
		console.log(`\nNo se encontraron archivos ':Zone.Identifier' para eliminar.`);
	}
});
