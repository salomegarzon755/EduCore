(() => {
    const $ = id => document.getElementById(id);
    const token = localStorage.getItem('authToken');
    if (!token) { EduSesion.cerrarSesion('Inicia sesión para consultar tu cuenta.'); return; }
    let cuenta, busy = false, eliminar = false;
    const fields = ['nombre', 'apellidos', 'correo'];
    function msg(text, error = false) {
        $('mensaje').textContent = text;
        $('mensaje').classList.toggle('error', error);
    }
    function errors(values = {}) {
        fields.forEach(k => {
            $('error-' + k).textContent = values[k] || '';
            $(k).setAttribute('aria-invalid', String(Boolean(values[k])));
        });
    }
    function mode(edit) {
        fields.forEach(k => $(k).readOnly = !edit);
        $('editar').hidden = $('cambiarClave').hidden = $('eliminar').hidden = edit;
        $('guardar').hidden = $('cancelar').hidden = !edit;
        $('titulo').textContent = edit ? 'Edita tus datos' : 'Información personal';
        $('ayuda').textContent = edit ? 'Puedes actualizar tu correo y confirmar tus nombres y apellidos.' : 'Esta es la información registrada en tu cuenta.';
    }
    function render() {
        EduAvatares.actualizar(cuenta.avatar);
        $('perfilAvatar').src = EduAvatares.url(cuenta.avatar);
        $('cambiarAvatar').hidden = false;
        fields.forEach(k => $(k).value = cuenta[k] ?? (k === 'nombre' ? cuenta.nombre_completo : ''));
        $('apodo').value = cuenta.usuario || '';
        $('rol').value = cuenta.rol;
        $('usuario').textContent = $('perfilNombre').textContent = cuenta.nombre_completo;
        const home = cuenta.rol === 'Docente' ? 'PanelDocente/PanelPrincipal.html' : 'PanelEstudiante/Inicio.html';
        $('inicio').href = $('volver').href = home;
    }
    async function api(method, body, path = '') {
        const r = await fetch(window.API_BASE_URL + '/cuenta' + path, {
            method, headers: {Authorization: 'Bearer ' + token, 'Content-Type': 'application/json'},
            ...(body ? {body: JSON.stringify(body)} : {})
        });
        const d = await r.json();
        if (!r.ok || !d.success) throw d;
        return d;
    }
    $('editar').onclick = () => { mode(true); errors(); msg(''); $('nombre').focus(); };
    $('cancelar').onclick = () => { if (!busy) { render(); errors(); mode(false); msg(''); } };
    $('form').onsubmit = async e => {
        e.preventDefault();
        if (busy || $('nombre').readOnly) return;
        const values = Object.fromEntries(fields.map(k => [k, $(k).value.trim()]));
        const data = {}, invalid = {};
        const inicialNombre = cuenta.nombre ?? cuenta.nombre_completo ?? '';
        if (values.nombre !== inicialNombre || values.apellidos !== (cuenta.apellidos ?? '')) {
            for (const k of ['nombre', 'apellidos']) {
                if (!values[k] || values[k].length > 100) invalid[k] = 'Completa este campo.';
                data[k] = values[k];
            }
        }
        if (values.correo !== (cuenta.correo ?? '')) {
            data.correo = values.correo;
            if (!values.correo || !$('correo').validity.valid) invalid.correo = 'Escribe un correo válido.';
        }
        errors(invalid);
        if (Object.keys(invalid).length) { msg('Revisa los campos.', true); return; }
        if (!Object.keys(data).length) { mode(false); return; }
        busy = true;
        $('guardar').disabled = $('cancelar').disabled = true;
        try {
            cuenta = (await api('PATCH', data)).cuenta;
            const user = EduAvatares.usuario();
            user.nombre = cuenta.nombre_completo;
            localStorage.setItem('currentUser', JSON.stringify(user));
            localStorage.setItem('loggedUserName', cuenta.nombre_completo);
            render(); mode(false); msg('✓ Tu información se actualizó correctamente.');
        } catch (err) { errors(err.errors); msg(err.message || 'No fue posible guardar los cambios.', true); }
        finally { busy = false; $('guardar').disabled = $('cancelar').disabled = false; }
    };
    function abrirDialogo(esEliminar) {
        eliminar = esEliminar;
        $('formCredenciales').reset(); $('dialogError').textContent = '';
        $('dialogTitulo').textContent = eliminar ? '¿Eliminar tu cuenta?' : 'Cambiar contraseña';
        $('dialogTexto').textContent = eliminar ? 'No podrás volver a ingresar. Tu historial académico se conservará. Confirma con tu contraseña.' : 'Al guardar, se cerrarán todas tus sesiones. Ingresa nuevamente con tu nueva contraseña.';
        $('nuevas').hidden = eliminar;
        $('nueva').required = $('confirmacion').required = !eliminar;
        $('confirmarDialogo').textContent = eliminar ? 'Eliminar cuenta' : 'Guardar contraseña';
        $('confirmarDialogo').classList.toggle('peligro', eliminar);
        $('dialogo').showModal();
    }
    $('cambiarClave').onclick = () => abrirDialogo(false);
    $('eliminar').onclick = () => abrirDialogo(true);
    $('cancelarDialogo').onclick = () => { if (!busy) $('dialogo').close(); };
    $('dialogo').addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    $('dialogo').addEventListener('close', () => $('formCredenciales').reset());
    $('formCredenciales').onsubmit = async e => {
        e.preventDefault();
        if (busy) return;
        const data = {contrasena_actual: $('actual').value};
        if (eliminar) data.confirmar = true;
        else {
            data.contrasena_nueva = $('nueva').value;
            data.confirmacion = $('confirmacion').value;
            if (data.contrasena_nueva !== data.confirmacion) { $('dialogError').textContent = 'Las contraseñas no coinciden.'; return; }
        }
        busy = true;
        $('confirmarDialogo').disabled = $('cancelarDialogo').disabled = true;
        try {
            await api(eliminar ? 'DELETE' : 'PATCH', data, eliminar ? '' : '/contrasena');
            $('dialogo').close();
            if (eliminar) {
                ['authToken','currentUser','loggedUserName','familyGroupId','userName'].forEach(k => localStorage.removeItem(k));
                sessionStorage.clear();
                sessionStorage.setItem('cuentaEliminada', 'true');
                location.replace('CuentaEliminada.html');
            } else EduSesion.cerrarSesion('Contraseña actualizada. Ingresa con tu nueva contraseña.');
        } catch (err) { $('dialogError').textContent = err.message || 'No fue posible completar la operación.'; }
        finally { busy = false; $('confirmarDialogo').disabled = $('cancelarDialogo').disabled = false; }
    };
    api('GET').then(d => {
        cuenta = d.cuenta; render();
        $('editar').disabled = $('cambiarClave').disabled = $('eliminar').disabled = false;
    }).catch(e => {
        if (localStorage.getItem('userRole') === 'Padre o Madre') EduSesion.cerrarSesion('Inicia sesión con tu cuenta de estudiante o docente.');
        else msg(e.message || 'No fue posible cargar tu cuenta.', true);
    });
})();
