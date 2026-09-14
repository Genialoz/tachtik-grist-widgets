(() => {
  "use strict";

  /* =========================================================
     SUPPRESSION SÉCURISÉE DES CONTRIBUTIONS — V4

     Droits conservés :
     - Administrateur : toutes les contributions ;
     - Bureau contributeur : uniquement les contributions de son Bureau_origine ;
     - Lecteur : aucune suppression.

     V4 :
     - mémorise la version EXACTE au moment où la fiche détail est ouverte ;
     - ne remplace pas cette version si Grist recharge allRecords ensuite ;
     - relit CONTRIBUTIONS juste avant la suppression ;
     - bloque la suppression si Version_modification a changé ;
     - conserve les ACL et les droits existants.

     La sécurité définitive reste assurée par les ACL Grist.
     ========================================================= */


  /* =========================================================
     VERSION MÉMORISÉE À L'OUVERTURE DE LA FICHE
     ========================================================= */

  let deleteOpenedRecordId = null;
  let deleteOpenedVersion = null;


  function clearDeleteOpenedVersion() {
    deleteOpenedRecordId = null;
    deleteOpenedVersion = null;
  }


  function captureDeleteOpenedVersion(record) {
    if (!record) {
      clearDeleteOpenedVersion();
      return;
    }

    deleteOpenedRecordId = Number(record.id);
    deleteOpenedVersion = deleteContributionVersion(record);
  }


  /* =========================================================
     OUTILS DE VERSION
     ========================================================= */

  function deleteContributionVersion(record) {
    const raw =
      record
        ? record.Version_modification
        : null;

    const value =
      Number(raw);

    /*
     * Les anciennes lignes dont Version_modification est vide
     * sont considérées comme version 0.
     */
    return (
      Number.isFinite(value)
      && value > 0
    )
      ? Math.trunc(value)
      : 0;
  }


  async function fetchFreshContributionForDelete(recordId) {
    const table =
      await grist.docApi.fetchTable(
        "CONTRIBUTIONS"
      );

    const rows =
      tableToRows(table);

    return (
      rows.find(
        row =>
          Number(row.id)
          ===
          Number(recordId)
      )
      || null
    );
  }


  async function ensureContributionUnchangedBeforeDelete(record) {
    /*
     * IMPORTANT V4 :
     * on n'utilise PAS la version actuellement présente dans allRecords,
     * car Grist peut avoir rafraîchi cette ligne après une modification
     * effectuée dans un autre onglet.
     *
     * On compare avec la version figée à l'ouverture de la fiche.
     */
    if (
      Number(deleteOpenedRecordId) !== Number(record.id)
      || deleteOpenedVersion === null
    ) {
      const error =
        new Error(
          "La version de cette contribution n'a pas pu être vérifiée. "
          + "Fermez puis rouvrez la fiche avant de la supprimer."
        );

      error.code =
        "VERSION_CONFLICT";

      throw error;
    }


    const fresh =
      await fetchFreshContributionForDelete(
        Number(record.id)
      );


    if (!fresh) {
      const error =
        new Error(
          "Cette contribution n'existe plus dans Grist. Rechargez la liste avant de poursuivre."
        );

      error.code =
        "VERSION_CONFLICT";

      throw error;
    }


    const currentVersion =
      deleteContributionVersion(
        fresh
      );


    if (
      currentVersion
      !==
      Number(deleteOpenedVersion)
    ) {
      const error =
        new Error(
          "Cette contribution a été modifiée par un autre utilisateur depuis son ouverture. "
          + "La suppression n'a pas été effectuée. Fermez puis rouvrez la contribution avant de poursuivre."
        );

      error.code =
        "VERSION_CONFLICT";

      throw error;
    }


    return fresh;
  }


  /* =========================================================
     DROIT DE SUPPRESSION
     ========================================================= */

  function canDeleteTachtik(record) {
    if (!record) {
      return false;
    }


    /*
     * Administrateur : suppression globale.
     */
    if (
      currentRole === "administrateur"
    ) {
      return true;
    }


    /*
     * Bureau contributeur : suppression limitée aux contributions
     * dont le Bureau_origine correspond à UTILISATEURS.Bureau.
     */
    if (
      currentRole === "bureau contributeur"
    ) {
      return Boolean(
        currentUserBureauId
        && record._BureauId
        && Number(record._BureauId) === Number(currentUserBureauId)
      );
    }


    /*
     * Lecteur ou tout autre rôle.
     */
    return false;
  }


  /* =========================================================
     CRÉATION DU BOUTON
     ========================================================= */

  function ensureDeleteButton() {
    let button =
      document.getElementById(
        "delete-btn"
      );


    if (button) {
      return button;
    }


    const editButton =
      document.getElementById(
        "edit-btn"
      );


    if (!editButton) {
      return null;
    }


    /*
     * Conteneur commun :
     * Modifier + Supprimer.
     */
    let actions =
      document.getElementById(
        "detail-heading-actions"
      );


    if (!actions) {
      actions =
        document.createElement(
          "div"
        );

      actions.id =
        "detail-heading-actions";

      actions.style.display =
        "flex";

      actions.style.alignItems =
        "center";

      actions.style.justifyContent =
        "flex-end";

      actions.style.flexWrap =
        "wrap";

      actions.style.gap =
        "9px";


      editButton.parentNode.insertBefore(
        actions,
        editButton
      );


      actions.appendChild(
        editButton
      );
    }


    /*
     * Création du bouton Supprimer.
     */
    button =
      document.createElement(
        "button"
      );


    button.id =
      "delete-btn";

    button.type =
      "button";

    button.textContent =
      "🗑️ Supprimer";

    button.style.display =
      "none";

    button.style.padding =
      "10px 14px";

    button.style.border =
      "1px solid #e5a2aa";

    button.style.borderRadius =
      "11px";

    button.style.background =
      "#fff1f3";

    button.style.color =
      "#b23a49";

    button.style.fontSize =
      "12px";

    button.style.fontWeight =
      "850";

    button.style.cursor =
      "pointer";


    button.addEventListener(
      "mouseenter",
      () => {
        if (!button.disabled) {
          button.style.background =
            "#ffe5e9";
        }
      }
    );


    button.addEventListener(
      "mouseleave",
      () => {
        if (!button.disabled) {
          button.style.background =
            "#fff1f3";
        }
      }
    );


    button.addEventListener(
      "click",
      deleteCurrentContribution
    );


    actions.appendChild(
      button
    );


    /*
     * Quand on entre en modification,
     * on masque temporairement Supprimer.
     */
    editButton.addEventListener(
      "click",
      () => {
        button.style.display =
          "none";
      }
    );


    /*
     * Quand on annule la modification,
     * on réévalue le droit.
     */
    const cancelButton =
      document.getElementById(
        "cancel-edit-btn"
      );


    if (cancelButton) {
      cancelButton.addEventListener(
        "click",
        () => {
          setTimeout(
            () => {
              updateDeleteButton(
                getSelectedRecord()
              );
            },
            0
          );
        }
      );
    }


    /*
     * Même chose après Enregistrer.
     */
    const saveButton =
      document.getElementById(
        "save-edit-btn"
      );


    if (saveButton) {
      saveButton.addEventListener(
        "click",
        () => {
          setTimeout(
            () => {
              updateDeleteButton(
                getSelectedRecord()
              );
            },
            0
          );
        }
      );
    }


    return button;
  }


  /* =========================================================
     AFFICHAGE DU BOUTON SELON LE PROFIL
     ========================================================= */

  function updateDeleteButton(record) {
    const button =
      ensureDeleteButton();


    if (!button) {
      return;
    }


    button.style.display =
      canDeleteTachtik(record)
        ? "inline-flex"
        : "none";
  }


  /* =========================================================
     SUPPRESSION
     ========================================================= */

  async function deleteCurrentContribution() {
    const record =
      getSelectedRecord();


    if (
      !record
      || !canDeleteTachtik(record)
    ) {
      showToast(
        "Vous n'êtes pas autorisé à supprimer cette contribution."
      );

      return;
    }


    const numero =
      text(
        record.Numero
      ).trim();


    const titre =
      text(
        record.Titre
      ).trim();


    const libelle =
      [
        numero,
        titre
      ]
        .filter(Boolean)
        .join(" — ");


    const confirmed =
      window.confirm(
        `Supprimer définitivement la contribution ${libelle || "sélectionnée"} ?\n\nCette action est irréversible.`
      );


    if (!confirmed) {
      return;
    }


    const button =
      ensureDeleteButton();


    try {
      if (button) {
        button.disabled =
          true;

        button.textContent =
          "Suppression…";

        button.style.opacity =
          ".65";

        button.style.cursor =
          "wait";
      }


      /*
       * V4 — verrouillage optimiste :
       * comparaison avec la version mémorisée à l'ouverture de la fiche.
       */
      await ensureContributionUnchangedBeforeDelete(
        record
      );


      /*
       * Suppression définitive.
       * Les ACL Grist restent le contrôle final côté données.
       */
      await grist.docApi.applyUserActions([
        [
          "RemoveRecord",
          "CONTRIBUTIONS",
          Number(record.id)
        ]
      ]);


      clearDeleteOpenedVersion();


      closeDetail();


      showToast(
        "🗑️ Contribution supprimée"
      );


      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            500
          )
      );


      await loadContributions();

    }
    catch (error) {
      console.error(
        error
      );


      if (
        error
        && error.code === "VERSION_CONFLICT"
      ) {
        showToast(
          error.message
        );

        return;
      }


      showToast(
        "Impossible de supprimer la contribution. Vérifiez les droits de suppression dans les règles d'accès Grist."
      );

    }
    finally {
      if (button) {
        button.disabled =
          false;

        button.textContent =
          "🗑️ Supprimer";

        button.style.opacity =
          "1";

        button.style.cursor =
          "pointer";

        button.style.background =
          "#fff1f3";
      }
    }
  }


  /* =========================================================
     INTÉGRATION AVEC L'OUVERTURE / FERMETURE DE LA FICHE
     ========================================================= */

  /*
   * V4 — on capture ici la version AVANT d'ouvrir la fiche.
   * Cette valeur reste figée même si grist.onRecords recharge allRecords.
   */
  const originalOpenDetail =
    openDetail;


  openDetail =
    function(recordId) {
      const record =
        getPilotRecords().find(
          row =>
            Number(row.id)
            ===
            Number(recordId)
        );


      captureDeleteOpenedVersion(
        record
      );


      return originalOpenDetail(
        recordId
      );
    };


  /*
   * On efface la version mémorisée quand l'utilisateur
   * quitte la fiche détail.
   */
  const originalCloseDetail =
    closeDetail;


  closeDetail =
    function() {
      clearDeleteOpenedVersion();

      return originalCloseDetail();
    };


  /* =========================================================
     INTÉGRATION AVEC LE RENDU DE LA FICHE
     ========================================================= */

  const originalRenderDetail =
    renderDetail;


  renderDetail =
    function(record) {
      originalRenderDetail(
        record
      );


      updateDeleteButton(
        record
      );
    };


  /* =========================================================
     INITIALISATION
     ========================================================= */

  ensureDeleteButton();


  updateDeleteButton(
    getSelectedRecord()
  );

})();
