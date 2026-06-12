import { getTimestamp } from '../support/utils';

describe('Grievance hierarchical category picker (PR #25)', () => {
  beforeEach(function () {
    cy.login();
  });

  it('creates a grievance with a nested child category and round-trips the full_name', function () {
    const ts = getTimestamp();
    const data = {
      title: `E2E Cascader Child ${ts}`,
      category: ['complaint', 'general_complaint'],
      flag: 'public',
      channel: 'Channel A',
      details: 'Nested category selection.',
      reporterType: 'None',
    };
    cy.createGrievance(data);
    cy.visit('/front/ticket/tickets');
    cy.checkGrievanceFieldValuesInListView(data.title, 'complaint > general_complaint');
    cy.getGrievanceCodeFromList(data.title).then((code) => {
      cy.searchAndOpenGrievanceForEdit(code);
      cy.assertGrievanceCategoryValue('complaint > general_complaint');
    });
  });

  it('creates a grievance selecting a parent-only category (changeOnSelect)', function () {
    const ts = getTimestamp();
    const data = {
      title: `E2E Cascader Parent ${ts}`,
      category: ['complaint'],
      flag: 'public',
      channel: 'Channel A',
      details: 'Parent-only selection.',
      reporterType: 'None',
    };
    cy.createGrievance(data);
    cy.visit('/front/ticket/tickets');
    cy.checkGrievanceFieldValuesInListView(data.title, 'complaint');
  });

  it('supports a backward-compatible simple string category', function () {
    const ts = getTimestamp();
    const data = {
      title: `E2E Cascader Simple ${ts}`,
      category: ['feedback'],
      flag: 'public',
      channel: 'Channel A',
      details: 'Simple string category remains selectable.',
      reporterType: 'None',
    };
    cy.createGrievance(data);
    cy.visit('/front/ticket/tickets');
    cy.checkGrievanceFieldValuesInListView(data.title, 'feedback');
  });

  it('clears the category selection with the clear button', function () {
    cy.visit('/front/ticket/newTicket');
    cy.chooseGrievanceCategory(['complaint', 'vbg_complaint']);
    cy.assertGrievanceCategoryValue('complaint > vbg_complaint');

    cy.contains('label', 'Category')
      .siblings('.MuiInputBase-root')
      .find('button')
      .first()
      .click();

    cy.contains('label', 'Category')
      .siblings('.MuiInputBase-root')
      .find('input')
      .should('have.value', '');
  });
});
