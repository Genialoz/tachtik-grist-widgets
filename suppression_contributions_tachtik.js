(() => {
  "use strict";

  /* =========================================================
     SUPPRESSION SÉCURISÉE DES CONTRIBUTIONS — V3

     Droits conservés :
     - Administrateur : toutes les contributions ;
     - Bureau contributeur : uniquement les contributions de son Bureau_origine ;
     - Lecteur : aucune suppression.

     V3 :
     - contrôle de CONTRIBUTIONS.Version_modification juste avant suppression ;
     - blocage si la contribution a été modifiée depuis la fiche affichée ;
     - aucune modification des ACL Grist ;
     - aucune modification des règles de droits existantes.

     La sécurité définitive reste assurée par les ACL Grist.
     ========================================================= */


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


  async function ensureContributionUnchangedBeforeDelete(
    record
  ) {

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


    const expectedVersion =
      deleteContributionVersion(
        record
      );


    const currentVersion =
      deleteContributionVersion(
        fresh
      );


    if (
      currentVersion
      !==
      expectedVersion
    ) {

      const error =
        new Error(
          "Cette contribution a été modifiée par un autre utilisateur. "
          + "La suppression n'a pas été effectuée. Rechargez la contribution avant de poursuivre."
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


    /*
     * Le bouton existe déjà.
     */
    if (button) {
      return button;
    }


    /*
     * On se sert du bouton Modifier
     * comme point d'insertion.
     */
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


      /*
       * On place le conteneur
       * à l'endroit où se trouvait Modifier.
       */
      editButton.parentNode.insertBefore(
        actions,
        editButton
      );


      /*
       * On remet Modifier
       * dans ce nouveau conteneur.
       */
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


    /*
     * Caché tant qu'on ne connaît pas
     * les droits de l'utilisateur.
     */
    button.style.display =
      "none";


    /*
     * Style du bouton.
     */
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


    /*
     * Survol.
     */
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


    /*
     * Suppression.
     */
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


    /*
     * Le bouton apparaît uniquement si
     * le profil possède réellement
     * le droit de supprimer cette ligne.
     */
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


    /*
     * Double contrôle côté interface.
     *
     * Les ACL Grist feront de toute façon
     * le contrôle définitif côté données.
     */
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


    /*
     * Confirmation obligatoire.
     */
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

      /*
       * Blocage du bouton
       * pendant l'opération.
       */
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
       * V3 — VERROUILLAGE OPTIMISTE
       *
       * On relit CONTRIBUTIONS juste avant la suppression.
       * Si Version_modification a changé depuis la fiche affichée,
       * la suppression est bloquée.
       */
      await ensureContributionUnchangedBeforeDelete(
        record
      );


      /*
       * Suppression dans la table CONTRIBUTIONS.
       *
       * Les ACL Grist contrôlent réellement l'autorisation.
       */
      await grist.docApi.applyUserActions([
        [
          "RemoveRecord",
          "CONTRIBUTIONS",
          Number(record.id)
        ]
      ]);


      /*
       * Retour automatique à la liste.
       */
      closeDetail();


      showToast(
        "🗑️ Contribution supprimée"
      );


      /*
       * Petite temporisation pour laisser
       * Grist actualiser ses données.
       */
      await new Promise(
        resolve =>
          setTimeout(
            resolve,
            500
          )
      );


      /*
       * Recharge :
       * - liste ;
       * - KPI ;
       * - filtres.
       */
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


        /*
         * On recharge la fiche avec les données les plus récentes.
         */
        await loadContributions();

        return;
      }


      showToast(
        "Impossible de supprimer la contribution. Vérifiez les droits de suppression dans les règles d'accès Grist."
      );

    }
    finally {

      /*
       * Remise en état du bouton
       * si nécessaire.
       */
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
     INTÉGRATION AVEC LA FICHE DÉTAIL
     ========================================================= */

  /*
   * On conserve intégralement la fonction
   * renderDetail existante.
   *
   * On ajoute simplement notre contrôle
   * après son exécution.
   */
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
'''

out = Path("/mnt/data/suppression_contributions_tachtik_v3.js")
out.write_text(code, encoding="utf-8")

checks = {
    "Rôles actuels": (
        'currentRole === "administrateur"' in code
        and 'currentRole === "bureau contributeur"' in code
        and "gestionnaire e1" not in code.lower()
        and "bureau saisie" not in code.lower()
        and "bureau import" not in code.lower()
    ),
    "Version_modification": "Version_modification" in code,
    "Relecture fraîche": 'fetchTable(\n        "CONTRIBUTIONS"' in code,
    "Blocage conflit": "VERSION_CONFLICT" in code,
    "RemoveRecord conservé": '"RemoveRecord"' in code,
    "ACL inchangées": "La sécurité définitive reste assurée par les ACL Grist." in code,
    "Bouton Supprimer": "🗑️ Supprimer" in code,
}

print(f"Fichier créé : {out}")
print(f"Taille : {out.stat().st_size} octets")
for k, v in checks.items():
    print(f"{k}: {'OK' if v else 'ERREUR'}")

if not all(checks.values()):
    raise RuntimeError("Un contrôle final a échoué.")
