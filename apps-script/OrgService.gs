/**
 * Estrutura organizacional: diretorias, gerências, coordenações, cargos e
 * centros de custo. Espelha backend/src/modules/org.
 */

var OrgService = {
  listDirectorates: function () {
    return Tables.directorates.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  getDirectorate: function (id) {
    var d = Tables.directorates.get(id);
    if (!d) throw new Error('Diretoria não encontrada: ' + id);
    return d;
  },

  findDirectorateByName: function (name) {
    return Tables.directorates.findOne(function (r) {
      return r.name === name;
    });
  },

  createDirectorate: function (input) {
    return Tables.directorates.insert({
      name: input.name,
      annualBudget: Number(input.annualBudget || 0),
      active: true,
      createdAt: nowIso_(),
    });
  },

  updateDirectorate: function (id, input) {
    return Tables.directorates.update(id, input);
  },

  listManagements: function (directorateId) {
    return Tables.managements.where(function (r) {
      return !directorateId || r.directorateId === directorateId;
    });
  },

  createManagement: function (input) {
    return Tables.managements.insert({
      directorateId: input.directorateId,
      name: input.name,
      active: true,
      createdAt: nowIso_(),
    });
  },

  listCoordinations: function (managementId) {
    return Tables.coordinations.where(function (r) {
      return !managementId || r.managementId === managementId;
    });
  },

  createCoordination: function (input) {
    return Tables.coordinations.insert({
      managementId: input.managementId,
      name: input.name,
      active: true,
      createdAt: nowIso_(),
    });
  },

  listPositions: function () {
    return Tables.positions.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  getPosition: function (id) {
    var p = Tables.positions.get(id);
    if (!p) throw new Error('Cargo não encontrado: ' + id);
    return p;
  },

  findPositionByName: function (name) {
    return Tables.positions.findOne(function (r) {
      return r.name === name;
    });
  },

  createPosition: function (input) {
    return Tables.positions.insert({
      name: input.name,
      careerLevel: input.careerLevel || '',
      active: true,
      createdAt: nowIso_(),
    });
  },

  updatePosition: function (id, input) {
    return Tables.positions.update(id, input);
  },

  listCostCenters: function () {
    return Tables.costCenters.all().sort(function (a, b) {
      return a.name.localeCompare(b.name);
    });
  },

  findCostCenterByName: function (name) {
    return Tables.costCenters.findOne(function (r) {
      return r.name === name;
    });
  },

  createCostCenter: function (input) {
    return Tables.costCenters.insert({
      code: input.code,
      name: input.name,
      directorateId: input.directorateId || '',
      active: true,
      createdAt: nowIso_(),
    });
  },
};
