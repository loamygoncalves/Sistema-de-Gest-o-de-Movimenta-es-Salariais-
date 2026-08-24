/**
 * Gestão de usuários — aqui não existe senha: quem entra é resolvido pela
 * conta Google (ver Auth.gs), então cadastrar um usuário é apenas associar
 * um e-mail a um perfil e, se aplicável, a uma diretoria de escopo.
 */

var UsersService = {
  list: function () {
    return Tables.users.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  create: function (input) {
    var existing = Tables.users.findOne(function (r) {
      return r.email === input.email;
    });
    if (existing) throw new Error('Já existe um usuário com este e-mail: ' + input.email);
    return Tables.users.insert({
      name: input.name,
      email: input.email,
      role: input.role,
      directorateId: input.directorateId || '',
      active: true,
      createdAt: nowIso_(),
    });
  },

  update: function (id, input) {
    return Tables.users.update(id, input);
  },
};
