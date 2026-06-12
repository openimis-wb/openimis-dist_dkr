import { getTimestamp } from '../support/utils';

describe('Grievance fine-grained permissions (PR #35)', () => {
  const ts = getTimestamp();
  const uname = `e2e${String(Date.now()).slice(-5)}`; // interactive, <=8 chars
  const pwd = 'Xk9$mW3qLp!2';
  const complaintTitle = `E2E Perm Complaint ${ts}`;
  const enrollmentTitle = `E2E Perm Enrollment ${ts}`;

  before(function () {
    // Admin creates one complaint ticket and one enrollment ticket
    cy.login();
    cy.createGrievance({
      title: complaintTitle, category: ['complaint'], flag: 'public',
      channel: 'Channel A', details: 'visible to complaint agent', reporterType: 'None',
    });
    cy.createGrievance({
      title: enrollmentTitle, category: ['enrollment'], flag: 'public',
      channel: 'Channel A', details: 'hidden from complaint agent', reporterType: 'None',
    });

    // Provision a complaint-only role + user (omit all enrollment rights)
    cy.gqlLoginAsAdmin();
    cy.grievanceCategoryRights().then((rights) => {
      const complaintRights = rights.filter((r) =>
        /^(read|create|restricted_read)_.*complaint.*_grievance$/.test(r.codename) &&
        !/enrollment|missing_documents/.test(r.codename)
      ).map((r) => r.id);
      // Static base grievance rights the agent needs to operate at all:
      // 127000 view tickets, 127001 create ticket, 127004 view comments,
      // 127005 create comment, 127006 resolve. (Dynamic category rights are 127100+.)
      const rightsId = [127000, 127001, 127004, 127005, 127006, ...complaintRights];
      cy.provisionGrievanceRole(`E2E_Complaint_${Date.now()}`, rightsId).then((roleId) => {
        cy.provisionUser(uname, pwd, [roleId]);
      });
    });
  });

  it('restricted user sees only the complaint subtree in the category picker', function () {
    cy.loginAs(uname, pwd);
    cy.visit('/front/ticket/newTicket');
    cy.assertCategoryOptions({ present: ['complaint'], absent: ['enrollment'] });
  });

  it('restricted user list excludes tickets from inaccessible categories', function () {
    cy.loginAs(uname, pwd);
    cy.visit('/front/ticket/tickets');
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');
    cy.enterMuiInput('Title', 'E2E Perm');
    cy.contains('button', 'Search').click();
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');
    cy.contains('td', complaintTitle).should('exist');
    cy.contains('td', enrollmentTitle).should('not.exist');
  });

  it('Admin (full rights) sees both tickets', function () {
    cy.login();
    cy.visit('/front/ticket/tickets');
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');
    cy.enterMuiInput('Title', 'E2E Perm');
    cy.contains('button', 'Search').click();
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');
    cy.contains('td', complaintTitle).should('exist');
    cy.contains('td', enrollmentTitle).should('exist');
  });
});
