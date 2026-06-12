import { getTimestamp } from '../support/utils';

// Config-driven backend behaviours surfaced in the UI (BE PR #35):
//  - default_grievance_type assigned when no category is selected
//  - effective priority derived from a flag's configured priority
//  - restricted_read field masking (visible_fields)

describe('Grievance config-driven behaviours (PR #35)', () => {
  describe('default grievance type', () => {
    beforeEach(function () {
      cy.login();
    });

    it('assigns the default category (uncategorized) when none is selected', function () {
      const ts = getTimestamp();
      const title = `E2E No Category ${ts}`;
      // Category omitted on purpose — FE PR #23 makes it optional, and the backend
      // assigns default_grievance_type ('uncategorized' per grievance-config.json).
      cy.createGrievance({
        title, flag: 'public', channel: 'Channel A',
        details: 'No category selected.', reporterType: 'None',
      });

      cy.visit('/front/ticket/tickets');
      cy.checkGrievanceFieldValuesInListView(title, 'uncategorized');
    });
  });

  describe('flag-derived effective priority', () => {
    beforeEach(function () {
      cy.login();
    });

    it('derives Critical priority from the sensitive flag when none is set', function () {
      const ts = getTimestamp();
      const title = `E2E Flag Priority ${ts}`;
      // feedback has no configured priority (defaults to Medium); the 'sensitive' flag
      // is Critical. With no explicit priority, the backend's get_effective_priority
      // takes the higher of the two -> Critical.
      cy.createGrievance({
        title, category: ['feedback'], flag: 'sensitive', channel: 'Channel A',
        details: 'Priority derived from flag.', reporterType: 'None',
      });

      cy.getGrievanceCodeFromList(title).then((code) => {
        cy.searchAndOpenGrievanceForEdit(code);
        cy.assertMuiSelectValue('Priority', 'Critical');
      });
    });
  });

  describe('restricted_read field masking', () => {
    const ts = getTimestamp();
    const uname = `e2e${String(Date.now()).slice(-5)}`; // interactive, <=8 chars
    const pwd = 'Xk9$mW3qLp!2';
    const vbgTitle = `E2E Mask VBG ${ts}`;
    const parentTitle = `E2E Mask Parent ${ts}`;

    before(function () {
      cy.login();
      // A vbg_complaint ticket (visible_fields = id, status, category) the restricted user
      // will see MASKED, and a complaint-parent ticket the restricted user must NOT see.
      cy.createGrievance({
        title: vbgTitle, category: ['complaint', 'vbg_complaint'], flag: 'public',
        channel: 'Channel A', details: 'masked', reporterType: 'None',
      });
      cy.createGrievance({
        title: parentTitle, category: ['complaint'], flag: 'public',
        channel: 'Channel A', details: 'hidden', reporterType: 'None',
      });

      // Provision a user with ONLY restricted_read on vbg_complaint (127114) plus the base
      // view-tickets right (127000). Crucially NOT read_complaint_vbg_complaint (127120) —
      // restricted_read without read is what triggers visible_fields masking.
      cy.gqlLoginAsAdmin();
      cy.provisionGrievanceRole(`E2E_RestrictedRead_${Date.now()}`, [127000, 127114]).then((roleId) => {
        cy.provisionUser(uname, pwd, [roleId]);
      });
    });

    it('masks non-visible fields and hides inaccessible tickets', function () {
      cy.loginAs(uname, pwd);
      cy.visit('/front/ticket/tickets');
      cy.contains('tfoot', 'Rows Per Page').should('be.visible');

      // The vbg ticket's title is masked to "[Restricted]" (title not in visible_fields).
      cy.contains('td', '[Restricted]').should('exist');
      // Its category stays visible (category IS in visible_fields).
      cy.contains('td', /vbg/i).should('exist');
      // The complaint-parent ticket is not accessible at all -> filtered out of the list.
      cy.contains('td', parentTitle).should('not.exist');
    });

    it('Admin (full read) sees the real title, unmasked', function () {
      cy.login();
      cy.visit('/front/ticket/tickets');
      cy.contains('tfoot', 'Rows Per Page').should('be.visible');
      cy.enterMuiInput('Title', vbgTitle);
      cy.contains('button', 'Search').click();
      cy.contains('tfoot', 'Rows Per Page').should('be.visible');
      cy.contains('td', vbgTitle).should('exist');
    });
  });
});
