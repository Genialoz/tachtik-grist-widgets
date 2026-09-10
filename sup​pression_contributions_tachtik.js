(() => {
  "use strict";

  /* =========================================================
     TÂCHTIK
     Suppression sécurisée des contributions

     Droits :
     - Administrateur : toutes les contributions
     - Gestionnaire E1 : toutes les contributions
     - Bureau saisie : uniquement son Bureau_origine
     - Bureau import : uniquement son Bureau_origine
     - Lecteur : aucune suppression

     La sécurité définitive reste assurée par les ACL Grist.
     ========================================================= */


  /* =========================================================
     DROIT DE SUPPRESSION
     ========================================================= */

  function canDeleteTachtik(record) {

    if (!record) {
      return false;
    }

    /*
     * Administrateur
     * Gestionnaire E1
     */
    if (
      currentRole.startsWith("admin")
      || currentRole === "gestionnaire e1"
    ) {
      return true;
    }


    /*
     * Bureaux partenaires
     *
     * Ils ne peuvent supprimer que les contributions
     * dont le Bureau_origine correspond à leur propre bureau.
     */
    if (
      currentRole === "bureau saisie"
      || currentRole === "bureau import"
    ) {

      return Boolean(
        currentUserBureauId
        && record._BureauId
        && Number(record._BureauId) === Number(currentUserBureauId)
      );
    }


    /*
     * Lecteur ou tout autre rôle
     */
    return false;
  }


  /* =========================================================
     CRÉATION DU BOUTON
     ========================================================= */

  function ensureDeleteButton() {

    let button =
      document.getElementById("delete-btn");


    /*
     * Le bouton existe déjà
     */
    if (button) {
      return button;
    }


    /*
     * On se sert du bouton Modifier
     * comme point d'insertion.
     */
    const editButton =
      document.getElementById("edit-btn");


    if (!editButton) {
      return null;
    }


    /*
     * Conteneur commun :
     * Modifier + Supprimer
     */
    let actions =
      document.getElementById(
        "detail-heading-actions"
      );


    if (!actions) {

      actions =
        document.createElement("div");

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
     * Création du bouton Supprimer
     */
    button =
      document.createElement("button");


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
     * Style Tâchtik
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
     * Survol
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
     * Suppression
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
      text(record.Numero).trim();


    const titre =
      text(record.Titre).trim();


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
       * Suppression dans la table
       * CONTRIBUTIONS.
       *
       * C'est ici que les ACL Grist
       * contrôlent réellement l'autorisation.
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
          setTimeout(resolve, 500)
      );


      /*
       * Recharge :
       * - liste
       * - KPI
       * - filtres
       */
      await loadContributions();

    }
    catch (error) {

      console.error(error);


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
     INTÉGRATION AVEC LA FICHE DÉTAIL TÂCHTIK
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
