import { getTimestamp } from '../support/utils';

describe('Grievance category resolution times (PR #35)', () => {
  beforeEach(function () {
    cy.login();
  });

  const cases = [
    { name: 'category override', path: ['complaint'], expected: '3,0' },
    { name: 'child override', path: ['complaint', 'vbg_complaint'], expected: '1,0' },
    { name: 'inherited from parent', path: ['complaint', 'general_complaint'], expected: '3,0' },
  ];

  cases.forEach(({ name, path, expected }) => {
    it(`resolution time (${name}): ${path.join(' > ')} -> ${expected}`, function () {
      const ts = getTimestamp();
      const title = `E2E Resolution ${name} ${ts}`;
      cy.createGrievance({
        title, category: path, flag: 'public', channel: 'Channel A',
        details: 'resolution time test', reporterType: 'None',
      });
      cy.getGrievanceCodeFromList(title).then((code) => {
        cy.searchAndOpenGrievanceForEdit(code);
        cy.assertResolutionTime(expected);
      });
    });
  });
});
