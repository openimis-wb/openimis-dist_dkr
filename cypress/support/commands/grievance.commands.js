export function registerGrievanceCommands() {
  Cypress.Commands.add('getGrievanceCount', () => {
    const pattern = /\(\d+\) Grievance\(s\)/;
    return cy.contains(pattern)
      .invoke('text')
      .then((text) => {
        const match = text.match(/\((\d+)\) Grievance/);
        return parseInt(match?.[1], 10);
      });
  });

  Cypress.Commands.add('createGrievance', (grievanceData) => {
    cy.visit('/front/ticket/newTicket');

    // Title and Channel are the only required fields; Category and Flag are optional
    // (FE PR #23). Omitting Category lets the backend assign default_grievance_type.
    cy.enterMuiInput('Grievance Title', grievanceData.title);
    if (grievanceData.category) {
      cy.chooseGrievanceCategory(grievanceData.category);
    }
    if (grievanceData.flag) {
      cy.chooseMuiAutocomplete('Flag', grievanceData.flag);
    }
    cy.chooseMuiAutocomplete('Channel', grievanceData.channel);

    // Optional fields
    if (grievanceData.priority) {
      cy.chooseMuiSelect('Priority', grievanceData.priority);
    }

    if (grievanceData.dateOfIncident) {
      cy.contains('label', 'Date Of Incident')
        .parent()
        .find('input')
        .type(grievanceData.dateOfIncident);
    }

    if (grievanceData.assignedUser) {
      cy.chooseMuiAutocomplete('Assigned User', grievanceData.assignedUser);
    }

    if (grievanceData.details) {
      cy.enterMuiInput('DETAILS OF EVENT', grievanceData.details);
    }

    // Reporter type handling
    if (grievanceData.reporterType) {
      cy.chooseMuiSelect('Reporter Type', grievanceData.reporterType);

      if (grievanceData.reporterType === 'Individual') {
        if (grievanceData.benefitPlan) {
          cy.chooseMuiAutocomplete('Program', grievanceData.benefitPlan);
        }
        if (grievanceData.individual) {
          cy.chooseMuiAutocomplete('Individual', grievanceData.individual);
        } else {
          cy.chooseMuiAutocomplete('Individual');
        }
      } else if (grievanceData.reporterType === 'Beneficiary') {
        if (grievanceData.benefitPlan) {
          cy.chooseMuiAutocomplete('Program', grievanceData.benefitPlan);
        }
        if (grievanceData.beneficiary) {
          cy.chooseMuiAutocomplete('BeneficiaryPicker', grievanceData.beneficiary);
        } else {
          cy.chooseMuiAutocomplete('BeneficiaryPicker');
        }
      } else if (grievanceData.reporterType === 'Attending Staff') {
        if (grievanceData.attendingStaff) {
          cy.chooseMuiAutocomplete('Complainant', grievanceData.attendingStaff);
        } else {
          cy.chooseMuiAutocomplete('Complainant');
        }
      }
    }

    // Save the grievance
    cy.get('label[role="button"].MuiIconButton-colorPrimary').click();

    // Wait for creation to complete
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('exist');
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('not.exist');

    // Check journal for success
    cy.get('ul.MuiList-root li').first().click();
    cy.contains(`Created Ticket ${grievanceData.title}`).should('exist');
    cy.contains('Failed to create').should('not.exist');
  });

  Cypress.Commands.add('updateGrievance', (grievanceCode, updateData, immutableFields = {}) => {
    cy.visit('/front/ticket/tickets');
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    // Search for grievance by code
    cy.enterMuiInput('Code', grievanceCode);
    cy.contains('button', 'Search').click();
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    // Open grievance for edit
    cy.contains('td', grievanceCode)
      .parent('tr')
      .within(() => {
        cy.get('button[title="Edit"]').click();
      });

    if (immutableFields.reporterType) {
      cy.assertMuiInputDisabled('Reporter Type', immutableFields.reporterType);
    }

    if (immutableFields.reporterFieldLabel) {
      cy.get('body').then(($body) => {
        const labelText = immutableFields.reporterFieldLabel;
        const hasLabel = $body.find('label').toArray()
          .some((el) => el.textContent?.trim() === labelText);
        if (hasLabel) {
          cy.assertMuiInputDisabled(
            labelText,
            immutableFields.reporterFieldValue ?? null,
          );
        }
      });
    }

    // Update fields (excluding reporter type and reporter info)
    if (updateData.title) {
      cy.enterMuiInput('Title', updateData.title);
    }

    if (updateData.category) {
      cy.chooseGrievanceCategory(updateData.category);
    }

    if (updateData.flag) {
      cy.chooseMuiAutocomplete('Flag', updateData.flag);
    }

    if (updateData.channel) {
      cy.chooseMuiAutocomplete('Channel', updateData.channel);
    }

    if (updateData.priority) {
      cy.chooseMuiSelect('Priority', updateData.priority);
    }

    if (updateData.details) {
      cy.enterMuiInput('Description', updateData.details);
    }

    // Save changes
    cy.get('label[role="button"].MuiIconButton-colorPrimary').click();

    // Wait for update to complete
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('exist');
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('not.exist');

    // Check journal for success
    cy.get('ul.MuiList-root li').first().click();
    cy.contains('updated ticket', { timeout: 10000 }).should('exist');
    cy.contains('Failed to update').should('not.exist');
  });

  Cypress.Commands.add('resolveGrievance', (grievanceCode, comment = 'Resolved Grievance') => {
    cy.searchAndOpenGrievanceForEdit(grievanceCode);
    cy.addGrievanceComment(comment);

    // Click the tick mark icon on the first/latest comment to resolve
    cy.get('button[title="Resolve grievance with this comment."]').first().click();

    // Wait for resolve to complete
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('exist');
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('not.exist');

    // Check journal for success
    cy.get('ul.MuiList-root li').first().click();
    cy.contains('Resolve Ticket using comment', { timeout: 10000 }).should('exist');
    cy.contains('Failed').should('not.exist');
  });

  Cypress.Commands.add('unlockGrievance', (grievanceCode) => {
    cy.searchAndOpenGrievanceForEdit(grievanceCode);

    // Reopen a CLOSED grievance: the fe-core Form renders a LockOpen action button in its
    // header (no title/testid in this MUI build, and the old `paperHeaderAction` class is
    // gone), so target the button by the MUI LockOpenIcon SVG path it contains.
    cy.get('button svg path[d^="M12 17c1.1 0 2-.9 2-2"]', { timeout: 15000 })
      .parents('button')
      .first()
      .click();

    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('exist');
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('not.exist');

    cy.get('ul.MuiList-root li').first().click();
    cy.contains('Failed').should('not.exist');
  });

  Cypress.Commands.add('checkGrievanceFieldValues', (title, category, flag, channel, priority = null, details = null) => {
    cy.assertMuiInput('Grievance Title', title);
    cy.assertGrievanceCategoryValue(category);
    cy.assertMuiInput('Flag', flag);
    cy.assertMuiInput('Channel', channel);
    if (priority) {
      cy.assertMuiSelectValue('Priority', priority);
    }

    if (details) {
      cy.assertMuiInput('Description', details);
    }
  });

  Cypress.Commands.add('checkGrievanceFieldValuesInListView', (title, category) => {
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    cy.enterMuiInput('Title', title);
    cy.contains('button', 'Search').click();
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    cy.contains('td', title).should('exist');
    cy.contains('td', title)
      .parent('tr')
      .within(() => {
        cy.contains('td', category).should('exist');
      });
  });

  Cypress.Commands.add('getGrievanceCodeFromList', (title) => {
    cy.visit('/front/ticket/tickets');
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    cy.enterMuiInput('Title', title);
    cy.contains('button', 'Search').click();
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    return cy.contains('td', title)
      .parent('tr')
      .find('td')
      .first()
      .invoke('text')
      .then((code) => code.trim());
  });

  Cypress.Commands.add('searchAndOpenGrievanceForEdit', (grievanceCode) => {
    cy.visit('/front/ticket/tickets');
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    cy.enterMuiInput('Code', grievanceCode);
    cy.contains('button', 'Search').click();
    cy.contains('tfoot', 'Rows Per Page').should('be.visible');

    cy.contains('td', grievanceCode)
      .parent('tr')
      .within(() => {
        cy.get('button[title="Edit"]').click();
      });
  });

  Cypress.Commands.add('addGrievanceComment', (commentText, commentData = {}) => {
    cy.contains('button', 'Add Comment').click();
    // Use native HTMLInputElement value setter to avoid DOM detachment caused by
    // React's per-keystroke re-renders in TicketCommentsPanel (setInterval + controlled input).
    cy.contains('label', 'Comment')
      .siblings('.MuiInputBase-root')
      .find('input')
      .first()
      .then(($input) => {
        const inputEl = $input[0];
        const win = inputEl.ownerDocument.defaultView || window;
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          win.HTMLInputElement.prototype, 'value',
        ).set;
        nativeInputValueSetter.call(inputEl, commentText);
        inputEl.dispatchEvent(new Event('input', { bubbles: true }));
      });

    if (commentData.reporterType) {
      cy.chooseMuiSelect('Reporter Type', commentData.reporterType);

      if (commentData.reporterType === 'Individual') {
        if (commentData.benefitPlan) {
          cy.chooseMuiAutocomplete('Program', commentData.benefitPlan);
        }
        if (commentData.individual) {
          cy.chooseMuiAutocomplete('Individual', commentData.individual);
        } else {
          cy.chooseMuiAutocomplete('Individual');
        }
      } else if (commentData.reporterType === 'Beneficiary') {
        if (commentData.benefitPlan) {
          cy.chooseMuiAutocomplete('Program', commentData.benefitPlan);
        }
        if (commentData.beneficiary) {
          cy.chooseMuiAutocomplete('Beneficiary', commentData.beneficiary);
        } else {
          cy.chooseMuiAutocomplete('Beneficiary');
        }
      } else if (commentData.reporterType === 'Attending Staff') {
        if (commentData.attendingStaff) {
          cy.chooseMuiAutocomplete('Commenter', commentData.attendingStaff);
        } else {
          cy.chooseMuiAutocomplete('Commenter');
        }
      }
    }

    cy.contains('button', 'Save').click();

    // Wait for save mutation to complete before reloading
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('exist');
    cy.get('ul.MuiList-root li div[role="progressbar"]', { timeout: 15000 }).should('not.exist');

    cy.contains(commentText).should('exist');
  });

  // --- Hierarchical category (rc-cascader) ----------------------------------

  // Selects a category by path, e.g. cy.chooseGrievanceCategory(['complaint','general_complaint'])
  // or single-level cy.chooseGrievanceCategory(['feedback']). Asserts the resulting
  // read-only field shows the full_name joined by ' > '.
  Cypress.Commands.add('chooseGrievanceCategory', (path) => {
    const labels = Array.isArray(path) ? path : [path];

    // Wait for the Category field to be enabled (category data loaded from API).
    cy.contains('label', 'Category')
      .siblings('.MuiInputBase-root')
      .should('not.have.class', 'Mui-disabled');

    // Click the parent container to trigger the rc-cascader popup.
    cy.contains('label', 'Category').parent().click();

    labels.forEach((label) => {
      // The display label uses E(name): underscores become spaces, words are capitalized.
      // Scope the click to the VISIBLE cascader dropdown to avoid matching hidden remnants.
      const displayLabel = label.replace(/_/g, ' ');
      cy.get('.rc-cascader-dropdown:not(.rc-cascader-dropdown-hidden)')
        .contains(displayLabel, { matchCase: false })
        .click();
    });

    // Close the cascader popup by clicking outside (on the Category label).
    cy.contains('label', 'Category').click({ force: true });

    const expected = labels.join(' > ');
    cy.contains('label', 'Category')
      .siblings('.MuiInputBase-root')
      .find('input')
      .should('have.value', expected);
  });

  // Reads the cascader display value for detail/edit assertions.
  Cypress.Commands.add('assertGrievanceCategoryValue', (fullName) => {
    cy.contains('label', 'Category')
      .siblings('.MuiInputBase-root')
      .find('input')
      .should('have.value', fullName);
  });

  // Opens the cascader and asserts which top-level options are present/absent.
  Cypress.Commands.add('assertCategoryOptions', ({ present = [], absent = [] }) => {
    cy.contains('label', 'Category')
      .siblings('.MuiInputBase-root')
      .should('not.have.class', 'Mui-disabled');

    cy.contains('label', 'Category').parent().click();

    // Scope present/absent checks to the OPEN cascader dropdown. Asserting against the whole
    // page would let a negative (absent) check pass trivially if the dropdown never opened, or
    // a positive (present) check match the word elsewhere on the page. Exact (case-insensitive)
    // match so a present-check can't pass on a substring (e.g. 'complaint' must not match
    // 'general_complaint'/'vbg_complaint'), which matters for the permission assertions.
    const exact = (label) => new RegExp(
      `^${label.replace(/_/g, ' ').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i',
    );
    cy.get('.rc-cascader-dropdown:not(.rc-cascader-dropdown-hidden)')
      .should('be.visible')
      .within(() => {
        present.forEach((label) => cy.contains(exact(label)).should('exist'));
        absent.forEach((label) => cy.contains(exact(label)).should('not.exist'));
      });

    cy.contains('label', 'Category').click({ force: true });
  });

  // Asserts the RESOLUTION field (auto-filled at create from the category's resolution time)
  // equals the expected "days,hours" string. Call on the ticket edit/detail page.
  Cypress.Commands.add('assertResolutionTime', (expected) => {
    cy.contains('label', 'RESOLUTION')
      .siblings('.MuiInputBase-root')
      .find('textarea, input')
      .first()
      .should('have.value', expected);
  });

  // --- Permission provisioning (GraphQL) ------------------------------------

  const GQL = '/api/graphql';

  // Authenticate as Admin via tokenAuth, then fetch a CSRF token and store it as a Cypress
  // env so subsequent mutation helpers can include X-CSRFToken (required when MODE != dev).
  Cypress.Commands.add('gqlLoginAsAdmin', () => {
    cy.fixture('cred').then((cred) => {
      cy.request('POST', GQL, {
        query: `mutation { tokenAuth(username: "${cred.username}", password: "${cred.password}") { token } }`,
      }).then((resp) => {
        // A failed auth still returns HTTP 200 with a GraphQL `errors` array, so checking the
        // status alone would let a bad login slip through and fail later, confusingly.
        expect(resp.status, 'tokenAuth HTTP status').to.eq(200);
        expect(resp.body.errors, 'tokenAuth GraphQL errors').to.be.undefined;
        expect(resp.body?.data?.tokenAuth?.token, 'JWT token').to.be.a('string').and.not.be.empty;
      });
    });
    cy.request('POST', GQL, {
      query: `mutation { getCsrfToken { csrfToken } }`,
    }).then((resp) => {
      const token = resp.body?.data?.getCsrfToken?.csrfToken;
      if (!token) throw new Error(`getCsrfToken returned no token: ${JSON.stringify(resp.body)}`);
      Cypress.env('__csrfToken', token);
    });
  });

  // Poll a MutationLog by clientMutationId until SUCCESS (status 2) or fail.
  // Requires that gqlLoginAsAdmin has already been called (CSRF token stored).
  Cypress.Commands.add('waitForMutation', (clientMutationId) => {
    const poll = (attempt = 0) => {
      if (attempt > 30) throw new Error(`Mutation ${clientMutationId} did not succeed in time`);
      const csrf = Cypress.env('__csrfToken');
      return cy.request({
        method: 'POST',
        url: GQL,
        headers: { 'X-CSRFToken': csrf },
        body: {
          query: `{ mutationLogs(clientMutationId: "${clientMutationId}") { edges { node { status error } } } }`,
        },
      }).then((resp) => {
        const node = resp.body?.data?.mutationLogs?.edges?.[0]?.node;
        if (node && Number(node.status) === 2) return null;
        if (node && Number(node.status) === 1) throw new Error(`Mutation failed: ${node.error}`);
        cy.wait(1000);
        return poll(attempt + 1);
      });
    };
    return poll();
  });

  // Fetch generated grievance category right-IDs via the mgmt command -> [{id, codename}].
  Cypress.Commands.add('grievanceCategoryRights', () => {
    return cy.exec(
      'docker compose -f compose.yml -f compose.test.yml exec -T backend '
      + 'python manage.py manage_grievance_permissions list --format json',
    ).then((res) => {
      // The command emits noisy preamble (warnings, "Load cfg {...}") before the JSON array.
      // Find the first '[' that appears at the start of a line to skip embedded '[' in preamble.
      const nlIdx = res.stdout.indexOf('\n[');
      const start = nlIdx !== -1 ? nlIdx + 1 : res.stdout.indexOf('[');
      const text = res.stdout.slice(start);
      const trimmed = text.slice(0, text.lastIndexOf(']') + 1);
      return JSON.parse(trimmed).map((p) => ({ id: p.id, codename: p.codename }));
    });
  });

  // Create a role with the given numeric right IDs. Returns the integer role_id.
  Cypress.Commands.add('provisionGrievanceRole', (roleName, rightsId) => {
    const cmid = `e2e-role-${Date.now()}`;
    const ids = `[${rightsId.join(',')}]`;
    const csrf = Cypress.env('__csrfToken');
    return cy.request({
      method: 'POST',
      url: GQL,
      headers: { 'X-CSRFToken': csrf },
      body: {
        query: `mutation {
          createRole(input: {
            name: "${roleName}", isSystem: false, isBlocked: false,
            rightsId: ${ids}, clientMutationId: "${cmid}"
          }) { clientMutationId internalId }
        }`,
      },
    }).then(() => cy.waitForMutation(cmid)).then(() => {
      const csrfQ = Cypress.env('__csrfToken');
      return cy.request({
        method: 'POST',
        url: GQL,
        headers: { 'X-CSRFToken': csrfQ },
        body: {
          query: `{ role(name_Icontains: "${roleName}") { edges { node { id } } } }`,
        },
      }).then((r) => {
        // Validate the lookup before decoding: an empty edges array or an unexpected
        // Relay-id format would otherwise surface as a cryptic crash / NaN role id.
        const edges = r.body?.data?.role?.edges;
        expect(edges, `role "${roleName}" lookup returned no rows`).to.have.length.greaterThan(0);
        const decoded = atob(edges[0].node.id); // base64 of "RoleGQLType:<int>"
        const m = decoded.match(/:(\d+)$/);
        expect(m, `unexpected Relay id format: ${decoded}`).to.not.be.null;
        return Number(m[1]);
      });
    });
  });

  // Create an interactive user with a password and roles. Returns username.
  Cypress.Commands.add('provisionUser', (username, password, roleIds) => {
    const cmid = `e2e-user-${Date.now()}`;
    const roles = `[${roleIds.join(',')}]`;
    const csrf = Cypress.env('__csrfToken');
    return cy.request({
      method: 'POST',
      url: GQL,
      headers: { 'X-CSRFToken': csrf },
      body: {
        query: `mutation {
          createUser(input: {
            username: "${username}", otherNames: "E2E", lastName: "Agent",
            language: "en", userTypes: [INTERACTIVE], roles: ${roles},
            password: "${password}", clientMutationId: "${cmid}"
          }) { clientMutationId internalId }
        }`,
      },
    }).then(() => cy.waitForMutation(cmid)).then(() => username);
  });
}
