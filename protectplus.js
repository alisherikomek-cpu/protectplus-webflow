/* =========================================================
   Protect+ Webflow JS

   Файл для GitHub: protectplus.js
   Важно: в этот файл НЕ вставлять теги <script> и </script>.

   Что внутри:
   - мобильное меню;
   - состояние шапки после входа/выхода;
   - формы поддержки;
   - маски телефонов;
   - auth modal;
   - вход через Memberstack;
   - регистрация с тестовым SMS-кодом;
   - создание пользователя в Memberstack;
   - logout;
   - дополнительный hardfix для ошибки кода регистрации.
   ========================================================= */

/* =========================================================
   TEMPORARY: HIDE LOGIN BUTTONS

   Скрывает кнопку «Войти в личный кабинет» в шапке
   и аналогичные кнопки в мобильном меню.

   Чтобы вернуть кнопки позже, удалите этот блок целиком.
   ========================================================= */
(function temporarilyHideLoginButtons() {
  if (document.getElementById("protectplus-temporary-hide-login")) return;

  const style = document.createElement("style");
  style.id = "protectplus-temporary-hide-login";
  style.textContent = `
    .header_login,
    .header_login-guest,
    .menu_auth,
    .mobile_menu_login {
      display: none !important;
    }
  `;

  (document.head || document.documentElement).appendChild(style);
})();

document.addEventListener("DOMContentLoaded", function () {
  /* =========================
   MOBILE MENU 1
   ========================= */
  const burger = document.querySelector(".header_burger");
  const menu = document.querySelector(".mobile-menu");
  const menuClose = document.querySelector(".mobile_menu_close");
  const menuLinks = document.querySelectorAll(".mobile_menu_link");
  function openMenu() {
    if (!menu) return;
    menu.classList.add("is_open");
    document.body.classList.add("is_menu_open");
  }
  function closeMenu() {
    if (!menu) return;
    menu.classList.remove("is_open");
    document.body.classList.remove("is_menu_open");
  }
  if (burger && menu && menuClose) {
    burger.addEventListener("click", function (event) {
      event.preventDefault();
      openMenu();
    });
    menuClose.addEventListener("click", function (event) {
      event.preventDefault();
      closeMenu();
    });
    menuLinks.forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });
  }
  /* =========================
   GLOBAL HELPERS
   ========================= */
  function getDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }
  function setCaretEnd(input) {
    const length = input.value.length;
    try {
      input.setSelectionRange(length, length);
    } catch (error) {}
  }
  /* =========================
   HEADER LOGIN STATE + LOGOUT MODAL
   ========================= */
  const logoutModal = document.querySelector(".logout_modal");
  function setLoggedInState(isLoggedIn) {
    document.body.classList.add("ms_auth_ready");
    document.documentElement.classList.remove("pp_auth_logged_in");
    document.documentElement.classList.remove("pp_auth_logged_out");
    if (isLoggedIn) {
      document.body.classList.add("is_logged_in");
      document.documentElement.classList.add("pp_auth_logged_in");
      try {
        localStorage.setItem("protectplus_auth_hint", "logged_in");
      } catch (error) {}
    } else {
      document.body.classList.remove("is_logged_in");
      document.documentElement.classList.add("pp_auth_logged_out");
      try {
        localStorage.setItem("protectplus_auth_hint", "logged_out");
      } catch (error) {}
    }
  }
  function applyCachedHeaderState() {
    let hint = null;
    try {
      hint = localStorage.getItem("protectplus_auth_hint");
    } catch (error) {}
    if (hint === "logged_in") {
      document.body.classList.add("ms_auth_ready");
      document.body.classList.add("is_logged_in");
      document.documentElement.classList.add("pp_auth_logged_in");
      document.documentElement.classList.remove("pp_auth_logged_out");
    }
    if (hint === "logged_out") {
      document.body.classList.add("ms_auth_ready");
      document.body.classList.remove("is_logged_in");
      document.documentElement.classList.add("pp_auth_logged_out");
      document.documentElement.classList.remove("pp_auth_logged_in");
    }
  }
  applyCachedHeaderState();
  function goToLK() {
    const lkUrl = window.location.origin + "/lk";
    try {
      window.location.href = lkUrl;
    } catch (error) {
      console.error("window.location.href redirect failed:", error);
    }
    setTimeout(function () {
      if (window.location.pathname !== "/lk") {
        window.location.assign(lkUrl);
      }
    }, 250);
    setTimeout(function () {
      if (window.location.pathname !== "/lk") {
        window.location.replace(lkUrl);
      }
    }, 600);
  }
  function openLogoutModal() {
    if (!logoutModal) return;
    logoutModal.classList.add("is_open");
    document.body.classList.add("is_logout_open");
  }
  function closeLogoutModal() {
    if (!logoutModal) return;
    logoutModal.classList.remove("is_open");
    document.body.classList.remove("is_logout_open");
  }
  function syncMemberstackHeaderState(attempt) {
    const currentAttempt = attempt || 1;
    if (!window.$memberstackDom || !window.$memberstackDom.getCurrentMember) {
      if (currentAttempt < 20) {
        setTimeout(function () {
          syncMemberstackHeaderState(currentAttempt + 1);
        }, 250);
      } else {
        console.warn("Memberstack DOM is not ready after retries");
        setLoggedInState(false);
      }
      return;
    }
    window.$memberstackDom
      .getCurrentMember()
      .then(function (result) {
        const member = result && result.data ? result.data : null;
        if (member) {
          setLoggedInState(true);
          if (
            sessionStorage.getItem("protectplus_after_login_redirect") ===
            "true"
          ) {
            if (window.location.pathname !== "/lk") {
              goToLK();
              return;
            }
            sessionStorage.removeItem("protectplus_after_login_redirect");
          }
        } else {
          setLoggedInState(false);
        }
      })
      .catch(function (error) {
        console.error("Header auth state error:", error);
        document.body.classList.add("ms_auth_ready");
      });
  }
  syncMemberstackHeaderState();
  window.protectPlusSetLoggedIn = function () {
    setLoggedInState(true);
  };
  window.protectPlusSetLoggedOut = function () {
    setLoggedInState(false);
  };
  /* =========================
   SUPPORT FORM LOGIC

   ВАЖНО:
   - .support_form_block (форма на главной) отправляется напрямую в Make;
   - .support_form_email (страница поддержки) остаётся нативной формой Webflow
     и отправляется только в Webflow / Email notifications.

   После установки этого кода общий Webflow Webhook нужно удалить,
   иначе Webflow продолжит слать в Make все формы сайта.
   ========================= */
  const MAKE_MAIN_FORM_URL = "https://hook.eu1.make.com/efsph9tvluosjytr7gd5qw1eyix4g786";

  const supportFormBlocks = document.querySelectorAll(
    ".support_form_block, .support_form_email",
  );
  const successModal = document.querySelector(".custom_success_modal");
  const errorModal = document.querySelector(".custom_error_modal");
  const modalCloseButtons = document.querySelectorAll(".custom_modal_close");
  function openSupportModal(modal) {
    if (!modal) return;
    modal.classList.add("is_open");
    document.body.classList.add("is_modal_open");
  }
  function closeSupportModals() {
    if (successModal) successModal.classList.remove("is_open");
    if (errorModal) errorModal.classList.remove("is_open");
    document.body.classList.remove("is_modal_open");
    document.dispatchEvent(new Event("supportModalClosed"));
  }
  modalCloseButtons.forEach(function (button) {
    button.addEventListener("click", function (event) {
      event.preventDefault();
      closeSupportModals();
    });
  });
  [successModal, errorModal].forEach(function (modal) {
    if (!modal) return;
    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        closeSupportModals();
      }
    });
  });
  function updateSupportFilledField(field) {
    if (!field) return;
    const hasValue = field.value && field.value.trim() !== "";
    if (hasValue) {
      field.classList.add("is_filled");
    } else {
      field.classList.remove("is_filled");
    }
  }
  function updateAllSupportFilledStates() {
    document
      .querySelectorAll(
        ".support_input_certificate, .support_input_name, .support_input_phone, .support_input_email, .support_textarea",
      )
      .forEach(updateSupportFilledField);
  }
  window.updateSupportFilledStates = updateAllSupportFilledStates;
  document.addEventListener("input", function (event) {
    if (
      event.target.matches(
        ".support_input_certificate, .support_input_name, .support_input_phone, .support_input_email, .support_textarea",
      )
    ) {
      updateSupportFilledField(event.target);
    }
  });
  document.addEventListener("change", function (event) {
    if (
      event.target.matches(
        ".support_input_certificate, .support_input_name, .support_input_phone, .support_input_email, .support_textarea",
      )
    ) {
      updateSupportFilledField(event.target);
    }
  });
  document.addEventListener(
    "blur",
    function (event) {
      if (
        event.target.matches(
          ".support_input_certificate, .support_input_name, .support_input_phone, .support_input_email, .support_textarea",
        )
      ) {
        updateSupportFilledField(event.target);
      }
    },
    true,
  );
  supportFormBlocks.forEach(function (formBlock) {
    const form = formBlock.querySelector("form");
    const nativeSelect = formBlock.querySelector(".support_select");
    const certificateGroup = formBlock.querySelector(
      ".support_group_certificate",
    );
    const freeGroup = formBlock.querySelector(".support_group_free");
    const checkboxWrap = formBlock.querySelector(".support_checkbox_wrap");
    const checkbox = formBlock.querySelector(".support_checkbox");
    const webflowSuccess = formBlock.querySelector(".w-form-done");
    const webflowError = formBlock.querySelector(".w-form-fail");
    const isMainMakeForm = formBlock.classList.contains("support_form_block");
    const isEmailOnlyForm = formBlock.classList.contains("support_form_email");
    if (!form) return;
    let checkboxError = formBlock.querySelector(".support_checkbox_error");
    let customButton = null;
    let customOptions = null;
    let waitingForResult = false;
    let shouldResetOnModalClose = false;
    function saveInitialRequiredState(group) {
      if (!group) return;
      group
        .querySelectorAll("input, textarea, select")
        .forEach(function (field) {
          field.dataset.requiredInitial = field.required ? "true" : "false";
        });
    }
    function setGroupEnabled(group, enabled) {
  if (!group) return;

  group
    .querySelectorAll("input, textarea, select")
    .forEach(function (field) {
      field.disabled = !enabled;
      field.required =
        enabled && field.dataset.requiredInitial === "true";
    });

  /*
    Когда блок отключается, убираем оставшиеся ошибки телефона.
  */
  if (!enabled) {
    group
      .querySelectorAll(".phone_input_error")
      .forEach(function (error) {
        error.classList.remove("is_visible");
      });

    group
      .querySelectorAll(".support_input_phone")
      .forEach(function (phoneInput) {
        phoneInput.classList.remove("is_error");
      });
  }
}

    function updateFields() {
      if (!nativeSelect || !certificateGroup || !freeGroup) return;
      const selectedOption = nativeSelect.options[nativeSelect.selectedIndex];
      const selectedText = selectedOption
        ? selectedOption.textContent.trim().toLowerCase()
        : "";
      const isFreeQuestion = selectedText.includes("свободный вопрос");
      if (isFreeQuestion) {
        freeGroup.classList.add("is_active");
        certificateGroup.classList.add("is_hidden");
        setGroupEnabled(freeGroup, true);
        setGroupEnabled(certificateGroup, false);
      } else {
        freeGroup.classList.remove("is_active");
        certificateGroup.classList.remove("is_hidden");
        setGroupEnabled(freeGroup, false);
        setGroupEnabled(certificateGroup, true);
      }
    }
    function initCustomSelect() {
      if (!nativeSelect) return;
      /*
        На странице мог остаться старый или пустой кастомный select.
        Удаляем его и каждый раз собираем элемент заново.
      */
      formBlock
        .querySelectorAll(".custom_support_select")
        .forEach(function (existingSelect) {
          existingSelect.remove();
        });
      const customSelect = document.createElement("div");
      customSelect.className = "custom_support_select";
      customButton = document.createElement("button");
      customButton.type = "button";
      customButton.className = "custom_support_select_button";
      const list = document.createElement("div");
      list.className = "custom_support_select_list";
      const options = Array.from(nativeSelect.options);
      function updateButtonText() {
        const selectedOption = nativeSelect.options[nativeSelect.selectedIndex];
        customButton.textContent = selectedOption
          ? selectedOption.textContent
          : "";
      }
      options.forEach(function (option, optionIndex) {
        const item = document.createElement("div");
        item.className = "custom_support_select_option";
        item.textContent = option.textContent;
        item.dataset.index = optionIndex;
        if (optionIndex === nativeSelect.selectedIndex) {
          item.classList.add("is_selected");
        }
        item.addEventListener("click", function () {
          nativeSelect.selectedIndex = optionIndex;
          list
            .querySelectorAll(".custom_support_select_option")
            .forEach(function (el) {
              el.classList.remove("is_selected");
            });
          item.classList.add("is_selected");
          updateButtonText();
          nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
          customSelect.classList.remove("is_open");
        });
        list.appendChild(item);
      });
      updateButtonText();
      customSelect.appendChild(customButton);
      customSelect.appendChild(list);
      nativeSelect.insertAdjacentElement("afterend", customSelect);
      customOptions = list.querySelectorAll(".custom_support_select_option");
      customButton.addEventListener("click", function () {
        customSelect.classList.toggle("is_open");
      });
      document.addEventListener("click", function (event) {
        if (!customSelect.contains(event.target)) {
          customSelect.classList.remove("is_open");
        }
      });
    }
    function syncCustomSelect() {
      if (!nativeSelect || !customButton) return;
      const selectedOption = nativeSelect.options[nativeSelect.selectedIndex];
      customButton.textContent = selectedOption
        ? selectedOption.textContent
        : "";
      if (!customOptions) return;
      customOptions.forEach(function (option) {
        option.classList.remove("is_selected");
        if (Number(option.dataset.index) === nativeSelect.selectedIndex) {
          option.classList.add("is_selected");
        }
      });
    }
    function initCheckbox() {
      if (!checkboxWrap || !checkbox) return;
      if (!checkboxError) {
        checkboxError = document.createElement("div");
        checkboxError.className = "support_checkbox_error";
        checkboxError.textContent =
          "Пожалуйста, подтвердите согласие с политикой конфиденциальности.";
        checkboxWrap.insertAdjacentElement("afterend", checkboxError);
      }
      checkboxWrap.addEventListener("click", function (event) {
        event.preventDefault();
        checkbox.classList.toggle("is_active");
        if (checkbox.classList.contains("is_active")) {
          checkboxError.classList.remove("is_visible");
        }
      });
    }
    function restoreFormVisible() {
      form.style.display = "block";
      if (webflowSuccess) webflowSuccess.style.display = "none";
      if (webflowError) webflowError.style.display = "none";
    }
    function resetFormAfterSuccess() {
      form.reset();
      if (checkbox) checkbox.classList.remove("is_active");
      if (checkboxError) checkboxError.classList.remove("is_visible");
      if (nativeSelect) {
        nativeSelect.selectedIndex = 0;
        nativeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      syncCustomSelect();
      restoreFormVisible();
      updateAllSupportFilledStates();
    }
    function isElementShownByWebflow(element) {
      if (!element) return false;
      const style = element.getAttribute("style") || "";
      return (
        style.includes("display: block") ||
        style.includes("display:block") ||
        element.style.display === "block"
      );
    }
    function checkResult() {
      if (!waitingForResult) return;
      const formStyle = form.getAttribute("style") || "";
      const formWasHiddenByWebflow =
        formStyle.includes("display: none") ||
        formStyle.includes("display:none") ||
        form.style.display === "none";
      const successShown = isElementShownByWebflow(webflowSuccess);
      const errorShown = isElementShownByWebflow(webflowError);
      if (successShown || formWasHiddenByWebflow) {
        waitingForResult = false;
        shouldResetOnModalClose = true;
        restoreFormVisible();
        openSupportModal(successModal);
        return;
      }
      if (errorShown) {
        waitingForResult = false;
        restoreFormVisible();
        openSupportModal(errorModal);
        return;
      }
    }
    document.addEventListener("supportModalClosed", function () {
      if (shouldResetOnModalClose) {
        resetFormAfterSuccess();
        shouldResetOnModalClose = false;
      }
    });

    function getMainFormPhoneDigits(value) {
      let digits = String(value || "").replace(/\D/g, "");

      if (
        digits.length > 10 &&
        (digits.charAt(0) === "7" || digits.charAt(0) === "8")
      ) {
        digits = digits.slice(1);
      }

      return digits.slice(0, 10);
    }

    function validateMainMakeForm() {
      if (!form.checkValidity()) {
        form.reportValidity();
        return false;
      }

      const phoneInput = form.querySelector(".support_input_phone");

      if (phoneInput && !phoneInput.disabled) {
        const phoneDigits = getMainFormPhoneDigits(phoneInput.value);

        if (phoneDigits.length !== 10) {
          const itiWrap = phoneInput.closest(".iti") || phoneInput;
          let phoneError = itiWrap.parentElement
            ? itiWrap.parentElement.querySelector(".phone_input_error")
            : null;

          if (!phoneError) {
            phoneError = document.createElement("div");
            phoneError.className = "phone_input_error";
            phoneError.textContent =
              "Введите номер телефона полностью: +7 (777) 777-77-77";
            itiWrap.insertAdjacentElement("afterend", phoneError);
          }

          phoneError.classList.add("is_visible");
          phoneInput.focus();
          return false;
        }
      }

      return true;
    }

    function collectMainFormData() {
      const result = {};
      const formData = new FormData(form);

      formData.forEach(function (value, key) {
        if (key === "cf-turnstile-response") return;
        result[key] = value;
      });

      const phoneInput = form.querySelector(".support_input_phone");

      if (phoneInput && !phoneInput.disabled) {
        const localDigits = getMainFormPhoneDigits(phoneInput.value);
        result.phone = phoneInput.value || result.phone || "";
        result.phone_e164 = localDigits ? "+7" + localDigits : "";
      }

      return result;
    }

    function setMainFormSubmitting(isSubmitting) {
      const submitButton = form.querySelector('[type="submit"]');
      if (!submitButton) return;

      if (isSubmitting) {
        submitButton.dataset.originalValue =
          submitButton.value || submitButton.textContent || "Отправить";
        submitButton.disabled = true;

        if ("value" in submitButton) {
          submitButton.value = submitButton.dataset.wait || "Отправляем...";
        } else {
          submitButton.textContent = submitButton.dataset.wait || "Отправляем...";
        }
      } else {
        submitButton.disabled = false;
        const originalValue = submitButton.dataset.originalValue || "Отправить";

        if ("value" in submitButton) {
          submitButton.value = originalValue;
        } else {
          submitButton.textContent = originalValue;
        }
      }
    }

    function submitMainFormToMake() {
      if (
        !MAKE_MAIN_FORM_URL ||
        MAKE_MAIN_FORM_URL === "PASTE_MAKE_WEBHOOK_URL_HERE"
      ) {
        console.error("MAKE_MAIN_FORM_URL is not configured");
        openSupportModal(errorModal);
        return;
      }

      if (!validateMainMakeForm()) return;

      const data = collectMainFormData();
      const formName =
        form.getAttribute("data-name") ||
        form.getAttribute("name") ||
        "Support Form Block";

      const requestBody = {
        triggerType: "form_submission",
        payload: {
          name: formName,
          pageId: form.getAttribute("data-wf-page-id") || "",
          formElementId: form.getAttribute("data-wf-element-id") || "",
          submittedAt: new Date().toISOString(),
          pageUrl: window.location.href,
          source: "protectplus_main_form_direct",
          data: data,
        },

        /* Дублируем основные поля верхним уровнем для удобного маппинга в Make. */
        form_name: formName,
        name: data.name || data.Name || "",
        phone:
          data.phone_e164 ||
          data.phone ||
          data.Phone ||
          "",
        message: data.message || data.Message || "",
        email: data.email || data.Email || "",
      };

      setMainFormSubmitting(true);

      fetch(MAKE_MAIN_FORM_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("Make webhook HTTP " + response.status);
          }

          return response.text();
        })
        .then(function () {
          shouldResetOnModalClose = true;
          openSupportModal(successModal);
        })
        .catch(function (error) {
          console.error("Main form Make error:", error);
          openSupportModal(errorModal);
        })
        .finally(function () {
          setMainFormSubmitting(false);
        });
    }

    form.addEventListener(
      "submit",
      function (event) {
        if (checkbox && !checkbox.classList.contains("is_active")) {
          event.preventDefault();

          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }

          if (checkboxError) checkboxError.classList.add("is_visible");

          if (checkboxWrap) {
            checkboxWrap.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          }

          return false;
        }

        /*
          Главная форма: полностью отменяем нативную отправку Webflow
          и отправляем её напрямую в Make.
        */
        if (isMainMakeForm) {
          event.preventDefault();
          event.stopPropagation();

          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }

          submitMainFormToMake();
          return false;
        }

        /*
          Форма поддержки: ничего не отправляем в Make из JS.
          Её штатно обрабатывает Webflow, сохраняя заявку и отправляя email.
        */
        if (isEmailOnlyForm) {
          waitingForResult = true;
          setTimeout(checkResult, 300);
          setTimeout(checkResult, 700);
          setTimeout(checkResult, 1200);
          setTimeout(checkResult, 2000);
          setTimeout(checkResult, 3200);
          setTimeout(checkResult, 5000);
        }
      },
      true,
    );
    const observerConfig = {
      attributes: true,
      attributeFilter: ["style", "class"],
    };
    new MutationObserver(checkResult).observe(form, observerConfig);
    if (webflowSuccess) {
      new MutationObserver(checkResult).observe(webflowSuccess, observerConfig);
    }
    if (webflowError) {
      new MutationObserver(checkResult).observe(webflowError, observerConfig);
    }
    saveInitialRequiredState(certificateGroup);
    saveInitialRequiredState(freeGroup);
    initCustomSelect();
    initCheckbox();
    if (nativeSelect) {
      nativeSelect.addEventListener("change", updateFields);
    }
    updateFields();
  });
  updateAllSupportFilledStates();
  (function () {
    /* =========================
   SUPPORT PHONE MASK: intl-tel-input
   ========================= */
    const CSS_ITI =
      "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/css/intlTelInput.css";
    const JS_ITI =
      "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/intlTelInput.min.js";
    const JS_UTIL =
      "https://cdn.jsdelivr.net/npm/intl-tel-input@19.5.6/build/js/utils.js";
    function ensureLink(href) {
      const exists = Array.from(
        document.querySelectorAll('link[rel="stylesheet"]'),
      ).some(function (link) {
        return (link.href || "").includes(href);
      });
      if (exists) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    }
    function loadScript(src) {
      return new Promise(function (resolve, reject) {
        const script = document.createElement("script");
        script.src = src + "?cb=" + Date.now();
        script.async = true;
        script.onload = resolve;
        script.onerror = function () {
          reject(new Error("Failed to load " + src));
        };
        document.head.appendChild(script);
      });
    }
    function getLocalDigits(value) {
      const raw = String(value || "");
      let digits = getDigits(raw);
      if (!digits) return "";
      const trimmed = raw.trim();
      if (
        (trimmed.indexOf("+7") === 0 || trimmed.indexOf("+8") === 0) &&
        (digits[0] === "7" || digits[0] === "8")
      ) {
        digits = digits.slice(1);
      } else if (
        (digits[0] === "7" || digits[0] === "8") &&
        digits.length > 10
      ) {
        digits = digits.slice(1);
      }
      return digits.slice(0, 10);
    }
    function formatKzPhone(localDigits) {
      if (!localDigits) return "";
      let result = "+7";
      result += " (" + localDigits.slice(0, 3);
      if (localDigits.length < 3) return result;
      result += ")";
      if (localDigits.length === 3) return result + " ";
      result += " " + localDigits.slice(3, 6);
      if (localDigits.length <= 6) return result;
      result += "-" + localDigits.slice(6, 8);
      if (localDigits.length <= 8) return result;
      result += "-" + localDigits.slice(8, 10);
      return result;
    }
    function hardBlockNonDigits(input) {
      input.addEventListener("beforeinput", function (event) {
        if (event.inputType && event.inputType.startsWith("delete")) return;
        if (event.data == null) return;
        if (/^\d+$/.test(event.data)) return;
        event.preventDefault();
      });
    }
    function cleanOldCustomFlag(input) {
      const oldWrap = input.closest(".phone_input_wrap");
      if (!oldWrap) return;
      const parent = oldWrap.parentNode;
      parent.insertBefore(input, oldWrap);
      oldWrap.remove();
    }
    function getPhoneError(input) {
      const itiWrap = input.closest(".iti") || input;
      let error = itiWrap.parentElement.querySelector(".phone_input_error");
      if (!error) {
        error = document.createElement("div");
        error.className = "phone_input_error";
        error.textContent =
          "Введите номер телефона полностью: +7 (777) 777-77-77";
        itiWrap.insertAdjacentElement("afterend", error);
      }
      return error;
    }
    function showPhoneError(input) {
      getPhoneError(input).classList.add("is_visible");
    }
    function hidePhoneError(input) {
      const itiWrap = input.closest(".iti") || input;
      const error = itiWrap.parentElement.querySelector(".phone_input_error");
      if (error) {
        error.classList.remove("is_visible");
      }
    }
    function updatePhone(input) {
      const localDigits = getLocalDigits(input.value);
      input.value = formatKzPhone(localDigits);
      input.dataset.phoneLocal = localDigits;
      input.dataset.phoneE164 = localDigits ? "+7" + localDigits : "";
      hidePhoneError(input);
      setCaretEnd(input);
      updateAllSupportFilledStates();
    }
    function validatePhone(input) {
      const localDigits = getLocalDigits(input.value);
      if (localDigits.length !== 10) {
        showPhoneError(input);
        input.focus();
        setCaretEnd(input);
        return false;
      }
      hidePhoneError(input);
      return true;
    }
    function initOne(input) {
      if (input._kzPhoneReady) return;
      input._kzPhoneReady = true;
      cleanOldCustomFlag(input);
      input.setAttribute("type", "tel");
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("autocomplete", "tel");
      input.setAttribute("placeholder", "+7 (777) 777-77-77");
      input.setAttribute("maxlength", "18");
      hardBlockNonDigits(input);
      const form = input.form;
      let hidden = null;
      if (form) {
        hidden = form.querySelector('input[name="phone_e164"]');
        if (!hidden) {
          hidden = document.createElement("input");
          hidden.type = "hidden";
          hidden.name = "phone_e164";
          form.appendChild(hidden);
        }
      }
      if (typeof window.intlTelInput === "function") {
        window.intlTelInput(input, {
          initialCountry: "kz",
          onlyCountries: ["kz"],
          preferredCountries: ["kz"],
          allowDropdown: false,
          separateDialCode: false,
          nationalMode: false,
          autoPlaceholder: "off",
          formatOnDisplay: false,
          utilsScript: JS_UTIL,
        });
      }
      input.addEventListener("input", function () {
        updatePhone(input);
      });
      input.addEventListener("paste", function () {
        setTimeout(function () {
          updatePhone(input);
        }, 0);
      });
      input.addEventListener("blur", function () {
        updatePhone(input);
      });
      if (form) {
  form.addEventListener(
    "submit",
    function (event) {
      /*
        Если поле телефона отключено, значит сейчас выбрана
        тема с сертификатом, и телефон проверять не нужно.
      */
      if (input.disabled) {
        hidePhoneError(input);

        if (hidden) {
          hidden.value = "";
        }

        return;
      }

      const isValid = validatePhone(input);

      if (!isValid) {
        event.preventDefault();
        event.stopPropagation();

        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }

        return false;
      }

      if (hidden) {
        hidden.value = "7" + getLocalDigits(input.value);
      }
    },
    true,
  );
}
    }
    function initAll() {
      document.querySelectorAll(".support_input_phone").forEach(initOne);
    }
    async function boot() {
      ensureLink(CSS_ITI);
      if (typeof window.intlTelInput !== "function") {
        await loadScript(JS_ITI);
      }
      if (
        !Array.from(document.scripts).some(function (script) {
          return (script.src || "").includes("utils.js");
        })
      ) {
        loadScript(JS_UTIL).catch(function () {});
      }
      initAll();
      const observer = new MutationObserver(initAll);
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }
    boot();
  })();
  /* =========================
   AUTH MODAL LOGIC
   ========================= */
  const authModal = document.querySelector(".auth_modal");
  if (authModal) {
    const screens = {
      login: ".auth_login",
      registerIin: ".auth_register_iin",
      registerPhone: ".auth_register_phone",
      registerCode: ".auth_register_code",
      registerPassword: ".auth_register_password",
      registerEmail: ".auth_register_email",
      resetStart: ".auth_reset_start",
      resetCode: ".auth_reset_code",
      resetPassword: ".auth_reset_password",
    };
    let registerTimer = null;
    let resetTimer = null;
    /* =========================
     REGISTRATION STATE / DEMO SMS SETTINGS
     ========================= */
    const REGISTER_USE_MAKE = true;
    const REGISTER_TEST_CODE = "111111";
    const MAKE_REGISTER_SEND_CODE_URL = "https://hook.eu1.make.com/avb04nrliwhn44nuxzwue9breop38ujm";
    const MAKE_REGISTER_VERIFY_CODE_URL = "https://hook.eu1.make.com/rlij4k52h3jqmt4nwc7qfw85w98orw02";
    const registerState = {
      iin: "",
      memberEmail: "",
      phoneLocal: "",
      phoneMasked: "",
      phoneE164: "",
      codeRequestId: "",
      codeVerified: false,
      password: "",
      realEmail: "",
    };
    let registerCodeCheckBusy = false;
    function resetRegisterState() {
      registerState.iin = "";
      registerState.memberEmail = "";
      registerState.phoneLocal = "";
      registerState.phoneMasked = "";
      registerState.phoneE164 = "";
      registerState.codeRequestId = "";
      registerState.codeVerified = false;
      registerState.password = "";
      registerState.realEmail = "";
      registerCodeCheckBusy = false;
    }
    function getRegisterCodePhoneTextElement() {
      const screen = document.querySelector(".auth_register_code");
      if (!screen) return null;
      const direct = screen.querySelector(
        ".auth_code_phone_text, [data-auth-code-phone-text]",
      );
      if (direct) return direct;
      const items = Array.from(screen.querySelectorAll("*")).filter(
        function (el) {
          if (el.closest("button,a,input,textarea,select")) return false;
          const text = String(el.textContent || "")
            .trim()
            .toLowerCase();
          if (!text) return false;
          return (
            text.includes("+7 (777)") ||
            text.includes("+7") ||
            (text.includes("отправ") &&
              text.includes("код") &&
              (text.includes("номер") || text.includes("телефон")))
          );
        },
      );
      items.sort(function (a, b) {
        return (
          String(a.textContent || "").length -
          String(b.textContent || "").length
        );
      });
      return items[0] || null;
    }
    function setRegisterCodePhoneText() {
      const text = getRegisterCodePhoneTextElement();
      if (!text) return;
      text.textContent = registerState.phoneMasked
        ? "Мы отправили проверочный код на номер " + registerState.phoneMasked
        : "Мы отправили проверочный код на ваш номер телефона";
    }
    function saveRegisterPhone(input) {
      const localDigits = getAuthPhoneLocalDigits(input);
      registerState.phoneLocal = localDigits;
      registerState.phoneMasked = formatAuthPhone(localDigits);
      registerState.phoneE164 = "+7" + localDigits;
      registerState.codeVerified = false;
      registerState.codeRequestId = "";
      setRegisterCodePhoneText();
    }
    function sendRegisterCode() {
      setRegisterCodePhoneText();
      if (!REGISTER_USE_MAKE) {
        console.log("Demo SMS code:", REGISTER_TEST_CODE);
        registerState.codeRequestId = "demo-request";
        return Promise.resolve({
          ok: true,
          requestId: registerState.codeRequestId,
        });
      }
      if (!MAKE_REGISTER_SEND_CODE_URL) {
        return Promise.reject(
          new Error("MAKE_REGISTER_SEND_CODE_URL is empty"),
        );
      }
      return fetch(MAKE_REGISTER_SEND_CODE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          iin: registerState.iin,
          phone: registerState.phoneE164,
        }),
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data || data.ok === false) {
            throw new Error(
              data && data.message ? data.message : "Не удалось отправить код",
            );
          }
          registerState.codeRequestId =
            data.requestId || data.codeRequestId || "";
          if (data.phoneMasked) {
            registerState.phoneMasked = data.phoneMasked;
            setRegisterCodePhoneText();
          }
          return data;
        });
    }
    function verifyRegisterCode(code) {
      if (!REGISTER_USE_MAKE) {
        if (code === REGISTER_TEST_CODE) {
          return Promise.resolve({ ok: true });
        }
        return Promise.reject(new Error("Неверный код"));
      }
      if (!MAKE_REGISTER_VERIFY_CODE_URL) {
        return Promise.reject(
          new Error("MAKE_REGISTER_VERIFY_CODE_URL is empty"),
        );
      }
      return fetch(MAKE_REGISTER_VERIFY_CODE_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          iin: registerState.iin,
          phone: registerState.phoneMasked || registerState.phoneE164,
          code: code,
          requestId: registerState.codeRequestId,
        }),
      })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data || data.ok === false) {
            throw new Error(
              data && data.message ? data.message : "Неверный код",
            );
          }
          return data;
        });
    }
    function formatAuthCode(value) {
      const digits = getDigits(value).slice(0, 6);
      if (digits.length <= 3) return digits;
      return digits.slice(0, 3) + " " + digits.slice(3, 6);
    }
    function getAuthCodeDigits(input) {
      return getDigits(input ? input.value : "").slice(0, 6);
    }
    function showRegisterCodeError(input, text) {
      if (!input) return;
      input.classList.add("is_error");
      input.classList.add("isError");
      input.classList.remove("is_filled");
      let holder =
        input.closest(".auth_field") ||
        input.closest(".auth_password_wrap") ||
        input.parentElement;
      if (!holder) holder = input;
      let errorBox =
        holder.querySelector(".auth_code_error_runtime") ||
        (holder.parentElement &&
          holder.parentElement.querySelector(".auth_code_error_runtime"));
      if (!errorBox) {
        errorBox = document.createElement("div");
        errorBox.className =
          "auth_error auth_runtime_error auth_code_error_runtime is_visible";
        const errorText = document.createElement("div");
        errorText.className = "auth_error_text";
        errorBox.appendChild(errorText);
        if (holder.classList && holder.classList.contains("auth_field")) {
          holder.appendChild(errorBox);
        } else {
          holder.insertAdjacentElement("afterend", errorBox);
        }
      }
      const errorText = errorBox.querySelector(".auth_error_text") || errorBox;
      errorText.textContent =
        text || "Неверный код. Проверьте SMS и попробуйте ещё раз";
      errorBox.classList.add("is_visible");
      errorBox.style.setProperty("display", "flex", "important");
      errorBox.style.setProperty("margin-top", "8px", "important");
      errorBox.style.setProperty("color", "#ff3333", "important");
    }
    function hideRegisterCodeError(input) {
      if (!input) return;
      input.classList.remove("is_error");
      input.classList.remove("isError");
      const holder =
        input.closest(".auth_field") ||
        input.closest(".auth_password_wrap") ||
        input.parentElement;
      if (!holder) return;
      const boxes = [];
      const own = holder.querySelectorAll
        ? holder.querySelectorAll(".auth_code_error_runtime")
        : [];
      own.forEach(function (box) {
        boxes.push(box);
      });
      if (holder.parentElement) {
        holder.parentElement
          .querySelectorAll(".auth_code_error_runtime")
          .forEach(function (box) {
            boxes.push(box);
          });
      }
      boxes.forEach(function (box) {
        box.classList.remove("is_visible");
        box.style.setProperty("display", "none", "important");
      });
    }
    function handleRegisterCodeFilled(input) {
      if (registerCodeCheckBusy) return;
      const code = getAuthCodeDigits(input);
      if (code.length !== 6) return;
      registerCodeCheckBusy = true;
      verifyRegisterCode(code)
        .then(function () {
          registerState.codeVerified = true;
          hideRegisterCodeError(input);
          clearAuthFieldError(input);
          setTimeout(function () {
            showScreen("registerPassword");
          }, 200);
        })
        .catch(function () {
          registerState.codeVerified = false;
          showRegisterCodeError(
            input,
            "Неверный код. Проверьте SMS и попробуйте ещё раз",
          );
          if (input) input.focus();
        })
        .then(
          function () {
            registerCodeCheckBusy = false;
          },
          function () {
            registerCodeCheckBusy = false;
          },
        );
    }
    function getMemberstackSignupMethod() {
      if (!window.$memberstackDom) return null;
      return (
        window.$memberstackDom.signupMemberEmailPassword ||
        window.$memberstackDom.signupWithEmailPassword ||
        null
      );
    }
    /* =========================
     MEMBERSTACK SIGNUP FOR REGISTRATION
     ========================= */
    function signupRegisterMember() {
      const signupMethod = getMemberstackSignupMethod();
      if (!signupMethod) {
        return Promise.reject(new Error("Memberstack signup method not found"));
      }
      if (!registerState.iin || !registerState.memberEmail) {
        return Promise.reject(new Error("Register IIN is empty"));
      }
      if (!registerState.codeVerified) {
        return Promise.reject(new Error("Register code is not verified"));
      }
      if (!registerState.password) {
        return Promise.reject(new Error("Register password is empty"));
      }
      const customFields = {
        iin: registerState.iin,
        phone: registerState.phoneE164,
        "phone-verified": "true",
        "real-email": registerState.realEmail || "",
        "registration-status": "completed",
      };
      return signupMethod.call(window.$memberstackDom, {
        email: registerState.memberEmail,
        password: registerState.password,
        customFields: customFields,
      });
    }
    function finishRegisterWithSignup(errorInput) {
      signupRegisterMember()
        .then(function (result) {
          setLoggedInState(true);
          closeAuth();
          goToLK();
        })
        .catch(function (error) {
          console.error("Memberstack signup error:", error);
          const message = String(
            (error && error.message) || (error && error.error) || "",
          ).toLowerCase();
          if (!registerState.codeVerified) {
            showScreen("registerCode");
            const codeInput = document.querySelector(
              ".auth_register_code .auth_input_code",
            );
            showAuthFieldError(codeInput, "Сначала подтвердите код из SMS");
            return;
          }
          if (
            message.includes("already") ||
            message.includes("exist") ||
            message.includes("duplicate")
          ) {
            showAuthFieldError(
              errorInput,
              "Пользователь с таким ИИН уже зарегистрирован",
            );
          } else {
            showAuthFieldError(
              errorInput,
              "Не удалось завершить регистрацию. Попробуйте ещё раз",
            );
          }
        });
    }
    /* =========================
     AUTH SCREEN HELPERS
     ========================= */
    function openAuth(screenName) {
      authModal.classList.add("is_open");
      document.body.classList.add("is_auth_open");
      if ((screenName || "login") === "registerIin") {
        resetRegisterState();
      }
      showScreen(screenName || "login");
    }
    function closeAuth() {
      authModal.classList.remove("is_open");
      document.body.classList.remove("is_auth_open");
      clearAllAuthErrors();
    }
    function showScreen(screenName) {
      document.querySelectorAll(".auth_screen").forEach(function (screen) {
        screen.classList.remove("is_active");
      });
      const selector = screens[screenName] || screens.login;
      const target = document.querySelector(selector);
      if (!target) return;
      target.classList.add("is_active");
      clearAllAuthErrors();
      updateAllAuthFilled();
      if (screenName === "registerCode") {
        setRegisterCodePhoneText();
        resetRegisterCodeView();
      }
    }
    function updateAuthFilled(input) {
      if (!input || !input.classList || !input.classList.contains("auth_input"))
        return;
      const hasValue = input.value && input.value.trim() !== "";
      if (hasValue) {
        input.classList.add("is_filled");
      } else {
        input.classList.remove("is_filled");
      }
    }
    function updateAllAuthFilled() {
      document.querySelectorAll(".auth_input").forEach(updateAuthFilled);
    }
    function clearAuthFieldError(input) {
      if (!input) return;
      input.classList.remove("is_error");
      input.classList.remove("isError");
      const field = input.closest(".auth_field") || input.parentElement;
      if (!field) {
        updateAuthFilled(input);
        return;
      }
      field
        .querySelectorAll(".auth_error, .auth_field > .auth_error_text")
        .forEach(function (error) {
          error.classList.remove("is_visible");
          if (error.classList.contains("auth_runtime_error")) {
            error.style.setProperty("display", "none", "important");
          }
        });
      const nextError = field.nextElementSibling;
      if (
        nextError &&
        nextError.classList &&
        nextError.classList.contains("auth_runtime_error")
      ) {
        nextError.classList.remove("is_visible");
        nextError.style.setProperty("display", "none", "important");
      }
      updateAuthFilled(input);
    }
    function clearAllAuthErrors() {
      document.querySelectorAll(".auth_input").forEach(function (input) {
        input.classList.remove("is_error");
        input.classList.remove("isError");
        updateAuthFilled(input);
      });
      document.querySelectorAll(".auth_error").forEach(function (error) {
        error.classList.remove("is_visible");
      });
      document
        .querySelectorAll(".auth_field > .auth_error_text, .auth_runtime_error")
        .forEach(function (error) {
          error.classList.remove("is_visible");
        });
    }
    function showAuthFieldError(input, text) {
      if (!input) return;
      input.classList.add("is_error");
      input.classList.add("isError");
      input.classList.remove("is_filled");
      const field = input.closest(".auth_field") || input.parentElement;
      if (!field) return;
      let errorBox = field.querySelector(".auth_error");
      let errorText = errorBox
        ? errorBox.querySelector(".auth_error_text")
        : field.querySelector(":scope > .auth_error_text");
      if (!errorBox && !errorText) {
        errorBox = document.createElement("div");
        errorBox.className = "auth_error auth_runtime_error";
        errorText = document.createElement("div");
        errorText.className = "auth_error_text";
        errorBox.appendChild(errorText);
        field.insertAdjacentElement("afterend", errorBox);
      }
      if (errorText && text) {
        errorText.textContent = text;
      }
      if (errorBox) {
        errorBox.classList.add("is_visible");
        if (errorBox.classList.contains("auth_runtime_error")) {
          errorBox.style.setProperty("display", "flex", "important");
        }
      } else if (errorText) {
        errorText.classList.add("is_visible");
      }
    }
    function formatIin(digits) {
      return String(digits || "")
        .replace(/\D/g, "")
        .slice(0, 12);
    }
    function getIinDigits(input) {
      return getDigits(input ? input.value : "").slice(0, 12);
    }
    function getAuthPhoneLocalDigits(input) {
      const raw = String(input && input.value ? input.value : "");
      let digits = getDigits(raw);
      if (!digits) return "";
      const trimmed = raw.trim();
      if (trimmed.indexOf("+7") === 0 && digits[0] === "7") {
        digits = digits.slice(1);
      } else if (trimmed.indexOf("+8") === 0 && digits[0] === "8") {
        digits = digits.slice(1);
      } else if (
        (digits[0] === "7" || digits[0] === "8") &&
        digits.length > 10
      ) {
        digits = digits.slice(1);
      }
      return digits.slice(0, 10);
    }
    function formatAuthPhone(localDigits) {
      if (!localDigits) return "";
      let result = "+7";
      result += " (" + localDigits.slice(0, 3);
      if (localDigits.length < 3) return result;
      result += ")";
      if (localDigits.length === 3) return result + " ";
      result += " " + localDigits.slice(3, 6);
      if (localDigits.length <= 6) return result;
      result += "-" + localDigits.slice(6, 8);
      if (localDigits.length <= 8) return result;
      result += "-" + localDigits.slice(8, 10);
      return result;
    }
    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    }
    function validatePasswordScreen(screen) {
      if (!screen) return false;
      const password =
        screen.querySelector(".auth_input_password") ||
        screen.querySelector(".auth_input_reset_password");
      const repeat =
        screen.querySelector(".auth_input_password_repeat") ||
        screen.querySelector(".auth_input_reset_password_repeat");
      let ok = true;
      if (!password || password.value.trim().length < 8) {
        showAuthFieldError(
          password,
          "Пароль должен содержать минимум 8 символов",
        );
        ok = false;
      }
      if (!repeat || repeat.value.trim() !== password.value.trim()) {
        showAuthFieldError(repeat, "Пароли не совпадают");
        ok = false;
      }
      return ok;
    }
    /* =========================
     AUTH FORM SUBMIT PROTECTION
     ========================= */
    document.querySelectorAll(".auth_modal form").forEach(function (form) {
      form.setAttribute("novalidate", "true");
    });
    document.addEventListener(
      "submit",
      function (event) {
        const form = event.target.closest("form");
        if (!form) return;
        const loginForm = form.matches('[data-ms-form="login"]') ? form : null;
        if (loginForm) {
          const iinInput = loginForm.querySelector(".auth_input_iin");
          const hiddenEmail = loginForm.querySelector(".auth_login_email");
          if (iinInput && hiddenEmail) {
            const iinDigits = String(iinInput.value || "")
              .replace(/\D/g, "")
              .slice(0, 12);
            hiddenEmail.value = iinDigits + "@protectplus.local";
          }
          return;
        }
        if (!form.closest(".auth_modal")) return;
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        return false;
      },
      true,
    );
    document.addEventListener("input", function (event) {
      if (!event.target.matches(".auth_input")) return;
      clearAuthFieldError(event.target);
      updateAuthFilled(event.target);
    });
    document.addEventListener("change", function (event) {
      if (event.target.matches(".auth_input")) {
        updateAuthFilled(event.target);
      }
    });
    document.addEventListener(
      "blur",
      function (event) {
        if (event.target.matches(".auth_input")) {
          updateAuthFilled(event.target);
        }
      },
      true,
    );
    /* =========================
     AUTH FIELD MASKS
     ========================= */
    document.querySelectorAll(".auth_input_iin").forEach(function (input) {
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "12");
      input.setAttribute("placeholder", "XXXXXXXXXXXX");
      input.addEventListener("beforeinput", function (event) {
        if (event.inputType && event.inputType.startsWith("delete")) return;
        if (event.data == null) return;
        if (/^\d+$/.test(event.data)) return;
        event.preventDefault();
      });
      input.addEventListener("input", function () {
        input.value = formatIin(getDigits(input.value));
        setCaretEnd(input);
        updateAuthFilled(input);
      });
      input.addEventListener("paste", function () {
        setTimeout(function () {
          input.value = formatIin(getDigits(input.value));
          setCaretEnd(input);
          updateAuthFilled(input);
        }, 0);
      });
    });
    document.querySelectorAll(".auth_input_phone").forEach(function (input) {
      input.setAttribute("type", "tel");
      input.setAttribute("inputmode", "numeric");
      input.setAttribute("maxlength", "18");
      input.setAttribute("placeholder", "+7 (777) 777-77-77");
      input.addEventListener("beforeinput", function (event) {
        if (event.inputType && event.inputType.startsWith("delete")) return;
        if (event.data == null) return;
        if (/^\d+$/.test(event.data)) return;
        event.preventDefault();
      });
      input.addEventListener("input", function () {
        input.value = formatAuthPhone(getAuthPhoneLocalDigits(input));
        setCaretEnd(input);
        updateAuthFilled(input);
      });
      input.addEventListener("paste", function () {
        setTimeout(function () {
          input.value = formatAuthPhone(getAuthPhoneLocalDigits(input));
          setCaretEnd(input);
          updateAuthFilled(input);
        }, 0);
      });
    });
    document
      .querySelectorAll(".auth_input_code, .auth_input_reset_code")
      .forEach(function (input) {
        input.setAttribute("inputmode", "numeric");
        input.setAttribute("maxlength", "7");
        input.setAttribute("placeholder", "___ ___");
        input.addEventListener("beforeinput", function (event) {
          if (event.inputType && event.inputType.startsWith("delete")) return;
          if (event.data == null) return;
          if (/^\d+$/.test(event.data)) return;
          event.preventDefault();
        });
        input.addEventListener("input", function () {
          const digits = getAuthCodeDigits(input);
          input.value = formatAuthCode(digits);
          updateAuthFilled(input);
          if (
            digits.length < 6 &&
            input.classList.contains("auth_input_code")
          ) {
            registerState.codeVerified = false;
          }
          if (digits.length === 6) {
            if (input.classList.contains("auth_input_code")) {
              handleRegisterCodeFilled(input);
            }
            if (input.classList.contains("auth_input_reset_code")) {
              setTimeout(function () {
                showScreen("resetPassword");
              }, 250);
            }
          }
        });
        input.addEventListener("paste", function () {
          setTimeout(function () {
            const digits = getAuthCodeDigits(input);
            input.value = formatAuthCode(digits);
            updateAuthFilled(input);
            if (
              digits.length === 6 &&
              input.classList.contains("auth_input_code")
            ) {
              handleRegisterCodeFilled(input);
            }
          }, 0);
        });
      });
    document.querySelectorAll(".auth_password_eye").forEach(function (eye) {
      eye.addEventListener("click", function (event) {
        event.preventDefault();
        const wrap = eye.closest(".auth_password_wrap");
        if (!wrap) return;
        const input = wrap.querySelector("input");
        if (!input) return;
        input.type = input.type === "password" ? "text" : "password";
      });
    });
    function resetRegisterCodeView() {
      const button = document.querySelector(
        ".auth_register_code .auth_button_resend",
      );
      const timer = document.querySelector(
        ".auth_register_code .auth_code_timer",
      );
      const codeInput = document.querySelector(
        ".auth_register_code .auth_input_code",
      );
      if (codeInput && !registerState.codeVerified) {
        codeInput.value = "";
        codeInput.classList.remove("is_error");
        codeInput.classList.remove("isError");
        hideRegisterCodeError(codeInput);
        updateAuthFilled(codeInput);
      }
      if (button) {
        button.classList.remove("is_hidden");
        button.classList.remove("is_visible");
      }
      if (timer) {
        timer.classList.remove("is_visible");
        timer.classList.remove("is_hidden");
      }
      if (registerTimer) {
        clearInterval(registerTimer);
        registerTimer = null;
      }
    }
    function startRegisterCodeTimer() {
      const button = document.querySelector(
        ".auth_register_code .auth_button_resend",
      );
      const timer = document.querySelector(
        ".auth_register_code .auth_code_timer",
      );
      if (!button || !timer) return;
      if (registerTimer) clearInterval(registerTimer);
      let seconds = 89;
      button.classList.add("is_hidden");
      timer.classList.remove("is_hidden");
      timer.classList.add("is_visible");
      function render() {
        const min = Math.floor(seconds / 60);
        const sec = String(seconds % 60).padStart(2, "0");
        timer.textContent = "Получить новый код можно через " + min + ":" + sec;
      }
      render();
      registerTimer = setInterval(function () {
        seconds -= 1;
        render();
        if (seconds <= 0) {
          clearInterval(registerTimer);
          registerTimer = null;
          timer.classList.remove("is_visible");
          timer.classList.add("is_hidden");
          button.classList.remove("is_hidden");
          button.classList.add("is_visible");
        }
      }, 1000);
    }
    function startResetCodeTimer() {
      const button = document.querySelector(
        ".auth_reset_code .auth_button_resend_code",
      );
      const timer = document.querySelector(
        ".auth_reset_code .auth_code_timer_phone",
      );
      if (!button || !timer) return;
      if (resetTimer) clearInterval(resetTimer);
      let seconds = 89;
      button.classList.remove("is_visible");
      timer.classList.remove("is_hidden");
      function render() {
        const min = Math.floor(seconds / 60);
        const sec = String(seconds % 60).padStart(2, "0");
        timer.textContent = "Получить новый код можно через " + min + ":" + sec;
      }
      render();
      resetTimer = setInterval(function () {
        seconds -= 1;
        render();
        if (seconds <= 0) {
          clearInterval(resetTimer);
          resetTimer = null;
          timer.classList.add("is_hidden");
          button.classList.add("is_visible");
        }
      }, 1000);
    }
    document.addEventListener(
      "click",
      function (event) {
        const headerLogin = event.target.closest(
          ".header_login, .header_login-guest, .menu_auth, .mobile_menu_login",
        );
        if (headerLogin) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }
          openAuth("login");
          return;
        }
        const authClose = event.target.closest(".auth_close");
        const authBackdrop = event.target.closest(".auth_backdrop");
        if (authClose || authBackdrop) {
          event.preventDefault();
          closeAuth();
          return;
        }
        const changeButton = event.target.closest(".auth_code_change");
        if (changeButton) {
          event.preventDefault();
          if (changeButton.closest(".auth_register_code")) {
            registerState.codeVerified = false;
            showScreen("registerPhone");
            return;
          }
          if (changeButton.closest(".auth_reset_code")) {
            showScreen("resetStart");
            return;
          }
        }
        const loginButton = event.target.closest(".auth_button_login");
        const registerButton = event.target.closest(".auth_button_register");
        const forgotButton = event.target.closest(".auth_forgot");
        const nextButton = event.target.closest(".auth_button_next");
        const saveButton = event.target.closest(".auth_button_save");
        const skipButton = event.target.closest(".auth_button_skip");
        const resetButton = event.target.closest(".auth_button_reset");
        const savePasswordButton = event.target.closest(
          ".auth_button_save_password",
        );
        const resendRegisterButton = event.target.closest(
          ".auth_button_resend",
        );
        const resendResetButton = event.target.closest(
          ".auth_button_resend_code",
        );
        if (
          !loginButton &&
          !registerButton &&
          !forgotButton &&
          !nextButton &&
          !saveButton &&
          !skipButton &&
          !resetButton &&
          !savePasswordButton &&
          !resendRegisterButton &&
          !resendResetButton
        ) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        if (event.stopImmediatePropagation) {
          event.stopImmediatePropagation();
        }
        if (loginButton) {
          const screen = loginButton.closest(".auth_login");
          const iin = screen ? screen.querySelector(".auth_input_iin") : null;
          const password = screen
            ? screen.querySelector(".auth_input_password")
            : null;
          let ok = true;
          if (!iin || getIinDigits(iin).length !== 12) {
            showAuthFieldError(iin, "Введите корректный ИИН");
            ok = false;
          }
          if (!password || password.value.trim() === "") {
            showAuthFieldError(password, "Введите пароль");
            ok = false;
          }
          if (!ok) return;
          const email = getIinDigits(iin) + "@protectplus.local";
          if (
            !window.$memberstackDom ||
            !window.$memberstackDom.loginMemberEmailPassword
          ) {
            console.error(
              "Memberstack DOM method loginMemberEmailPassword not found",
            );
            showAuthFieldError(
              password,
              "Ошибка подключения Memberstack. Обновите страницу",
            );
            return;
          }
          sessionStorage.setItem("protectplus_after_login_redirect", "true");
          window.$memberstackDom
            .loginMemberEmailPassword({
              email: email,
              password: password.value.trim(),
            })
            .then(function (result) {
              setLoggedInState(true);
              closeAuth();
              goToLK();
            })
            .catch(function (error) {
              console.error("Memberstack login error:", error);
              sessionStorage.removeItem("protectplus_after_login_redirect");
              showAuthFieldError(password, "Неверный ИИН или пароль");
            });
          return;
        }
        if (registerButton) {
          resetRegisterState();
          showScreen("registerIin");
          return;
        }
        if (forgotButton) {
          showScreen("resetStart");
          return;
        }
        if (nextButton) {
          const currentScreen = nextButton.closest(".auth_screen");
          if (
            currentScreen &&
            currentScreen.classList.contains("auth_register_iin")
          ) {
            const input = currentScreen.querySelector(".auth_input_iin");
            if (!input || getIinDigits(input).length !== 12) {
              showAuthFieldError(input, "Введите корректный ИИН");
              return;
            }
            registerState.iin = getIinDigits(input);
            registerState.memberEmail =
              registerState.iin + "@protectplus.local";
            registerState.codeVerified = false;
            showScreen("registerPhone");
            return;
          }
          if (
            currentScreen &&
            currentScreen.classList.contains("auth_register_phone")
          ) {
            const input = currentScreen.querySelector(".auth_input_phone");
            if (!input || getAuthPhoneLocalDigits(input).length !== 10) {
              showAuthFieldError(input, "Введите корректный номер телефона");
              return;
            }
            saveRegisterPhone(input);
            sendRegisterCode()
              .then(function () {
                showScreen("registerCode");
              })
              .catch(function () {
                showAuthFieldError(
                  input,
                  "Не удалось отправить код. Попробуйте ещё раз",
                );
              });
            return;
          }
          if (
            currentScreen &&
            currentScreen.classList.contains("auth_register_code")
          ) {
            const input = currentScreen.querySelector(".auth_input_code");
            if (!input || getAuthCodeDigits(input).length !== 6) {
              showRegisterCodeError(input, "Введите корректный код");
              return;
            }
            handleRegisterCodeFilled(input);
            return;
          }
          if (
            currentScreen &&
            currentScreen.classList.contains("auth_register_password")
          ) {
            if (!validatePasswordScreen(currentScreen)) return;
            const password = currentScreen.querySelector(
              ".auth_input_password",
            );
            registerState.password = password ? password.value.trim() : "";
            const emailScreen = document.querySelector(".auth_register_email");
            if (emailScreen) {
              showScreen("registerEmail");
            } else {
              registerState.realEmail = "";
              finishRegisterWithSignup(password);
            }
            return;
          }
        }
        if (saveButton && saveButton.closest(".auth_register_password")) {
          const passwordScreen = saveButton.closest(".auth_register_password");
          if (!validatePasswordScreen(passwordScreen)) return;
          const password = passwordScreen.querySelector(".auth_input_password");
          registerState.password = password ? password.value.trim() : "";
          const emailScreen = document.querySelector(".auth_register_email");
          if (emailScreen) {
            showScreen("registerEmail");
          } else {
            registerState.realEmail = "";
            finishRegisterWithSignup(password);
          }
          return;
        }
        if (saveButton) {
          const screen = saveButton.closest(".auth_register_email");
          const email = screen
            ? screen.querySelector(".auth_input_email")
            : null;
          if (
            email &&
            email.value.trim() !== "" &&
            !isValidEmail(email.value)
          ) {
            showAuthFieldError(email, "Введите корректный e-mail");
            return;
          }
          registerState.realEmail = email ? email.value.trim() : "";
          finishRegisterWithSignup(email);
          return;
        }
        if (skipButton) {
          registerState.realEmail = "";
          const emailInput = document.querySelector(
            ".auth_register_email .auth_input_email",
          );
          finishRegisterWithSignup(emailInput);
          return;
        }
        if (resetButton) {
          startResetCodeTimer();
          showScreen("resetCode");
          return;
        }
        if (savePasswordButton) {
          const registerPasswordScreen = savePasswordButton.closest(
            ".auth_register_password",
          );
          if (registerPasswordScreen) {
            if (!validatePasswordScreen(registerPasswordScreen)) return;
            const password = registerPasswordScreen.querySelector(
              ".auth_input_password",
            );
            registerState.password = password ? password.value.trim() : "";
            const emailScreen = document.querySelector(".auth_register_email");
            if (emailScreen) {
              showScreen("registerEmail");
            } else {
              registerState.realEmail = "";
              finishRegisterWithSignup(password);
            }
            return;
          }
          const screen = savePasswordButton.closest(".auth_reset_password");
          if (!validatePasswordScreen(screen)) return;
          showScreen("login");
          return;
        }
        if (resendRegisterButton) {
          const codeInput = document.querySelector(
            ".auth_register_code .auth_input_code",
          );
          if (codeInput) {
            codeInput.value = "";
            updateAuthFilled(codeInput);
            hideRegisterCodeError(codeInput);
            clearAuthFieldError(codeInput);
          }
          sendRegisterCode()
            .then(function () {
              startRegisterCodeTimer();
            })
            .catch(function () {
              showAuthFieldError(
                codeInput,
                "Не удалось отправить новый код. Попробуйте позже",
              );
            });
          return;
        }
        if (resendResetButton) {
          startResetCodeTimer();
        }
      },
      true,
    );
    document.addEventListener(
      "keydown",
      function (event) {
        if (event.key === "Enter" && event.target.closest(".auth_modal")) {
          event.preventDefault();
          event.stopPropagation();
          if (event.stopImmediatePropagation) {
            event.stopImmediatePropagation();
          }
          return false;
        }
        if (event.key === "Escape") {
          closeAuth();
        }
      },
      true,
    );
    showScreen("login");
    updateAllAuthFilled();
    setInterval(function () {
      updateAllAuthFilled();
    }, 700);
  }
  document.addEventListener("click", function (event) {
    const accountButton = event.target.closest(".header_account");
    const logoutButton = event.target.closest(".header_logout");
    const logoutClose = event.target.closest(".logout_close");
    const logoutBackdrop = event.target.closest(".logout_backdrop");
    const stayButton = event.target.closest(".logout_stay");
    const confirmButton = event.target.closest(".logout_confirm");
    if (accountButton) {
      event.preventDefault();
      window.location.href = "/lk";
      return;
    }
    if (logoutButton) {
      event.preventDefault();
      openLogoutModal();
      return;
    }
    if (logoutClose || logoutBackdrop || stayButton) {
      event.preventDefault();
      closeLogoutModal();
      return;
    }
    if (confirmButton) {
      event.preventDefault();
      sessionStorage.removeItem("protectplus_after_login_redirect");
      if (window.$memberstackDom && window.$memberstackDom.logout) {
        window.$memberstackDom
          .logout()
          .then(function () {
            setLoggedInState(false);
            closeLogoutModal();
            window.location.href = "/";
          })
          .catch(function (error) {
            console.error("Memberstack logout error:", error);
            setLoggedInState(false);
            closeLogoutModal();
            window.location.href = "/";
          });
      } else {
        setLoggedInState(false);
        closeLogoutModal();
        window.location.href = "/";
      }
      return;
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
      closeSupportModals();
      closeLogoutModal();
    }
  });
});

/* =========================================================
   HARDFIX: REGISTRATION CODE ERROR DISPLAY
   Тестовый код: 111111
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
  var OK = "111111";
  function d(v) {
    return String(v || "")
      .replace(/\D/g, "")
      .slice(0, 6);
  }
  function f(x) {
    x = d(x);
    return x.length > 3 ? x.slice(0, 3) + " " + x.slice(3) : x;
  }
  function q() {
    return document.querySelector(".auth_register_code .auth_input_code");
  }
  function e(i) {
    if (!i) return null;
    var p = i.closest(".auth_field") || i.parentElement;
    if (!p) return null;
    var b = p.querySelector(".auth_error");
    if (!b) {
      b = document.createElement("div");
      b.className = "auth_error auth_runtime_error";
      p.appendChild(b);
    }
    var t = b.querySelector(".auth_error_text");
    if (!t) {
      t = document.createElement("div");
      t.className = "auth_error_text";
      b.appendChild(t);
    }
    return { b: b, t: t };
  }
  function show(i, m) {
    var r = e(i);
    if (!i || !r) return;
    i.classList.add("is_error", "isError");
    i.classList.remove("is_filled");
    r.t.textContent = m || "Неверный код. Проверьте SMS и попробуйте ещё раз";
    r.b.classList.add("is_visible");
    r.b.style.cssText +=
      ";display:flex!important;visibility:visible!important;opacity:1!important;height:auto!important;overflow:visible!important;margin-top:8px!important;color:#ff3333!important;";
    r.t.style.cssText +=
      ";display:block!important;visibility:visible!important;opacity:1!important;color:#ff3333!important;font-size:13px!important;line-height:130%!important;";
  }
  function hide(i) {
    var r = e(i);
    if (i) {
      i.classList.remove("is_error", "isError");
      if (i.value.trim()) i.classList.add("is_filled");
    }
    if (r) {
      r.b.classList.remove("is_visible");
      r.b.style.cssText += ";display:none!important;";
    }
  }
  var s = document.createElement("style");
  s.textContent =
    ".auth_register_code .auth_error.is_visible,.auth_register_code .auth_runtime_error.is_visible{display:flex!important;visibility:visible!important;opacity:1!important;height:auto!important;overflow:visible!important;margin-top:8px!important;color:#ff3333!important}.auth_register_code .auth_error.is_visible *,.auth_register_code .auth_runtime_error.is_visible *{visibility:visible!important;opacity:1!important;color:#ff3333!important}.auth_register_code .auth_input_code.is_error,.auth_register_code .auth_input_code.isError{border-color:#ff3333!important;background:#fff!important;color:#222!important;box-shadow:none!important}";
  document.head.appendChild(s);
  function init() {
    var i = q();
    if (!i || i.dataset.codeHardFixReady === "true") return;
    i.dataset.codeHardFixReady = "true";
    i.setAttribute("inputmode", "numeric");
    i.setAttribute("maxlength", "7");
    i.setAttribute("placeholder", "___ ___");
    i.setAttribute("autocomplete", "one-time-code");
  }
  document.addEventListener(
    "beforeinput",
    function (ev) {
      var i =
        ev.target && ev.target.closest
          ? ev.target.closest(".auth_register_code .auth_input_code")
          : null;
      if (!i) return;
      if (ev.inputType && ev.inputType.indexOf("delete") === 0) return;
      if (ev.data == null) return;
      if (/^\d+$/.test(ev.data)) return;
      ev.preventDefault();
    },
    true,
  );
  document.addEventListener(
    "input",
    function (ev) {
      var i =
        ev.target && ev.target.closest
          ? ev.target.closest(".auth_register_code .auth_input_code")
          : null;
      if (!i) return;
      var x = d(i.value);
      i.value = f(x);
      if (x.length < 6) {
        hide(i);
        return;
      }
      if (x.length === 6 && x !== OK) {
        show(i, "Неверный код. Проверьте SMS и попробуйте ещё раз");
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        return;
      }
      hide(i);
    },
    true,
  );
  document.addEventListener(
    "blur",
    function (ev) {
      var i =
        ev.target && ev.target.closest
          ? ev.target.closest(".auth_register_code .auth_input_code")
          : null;
      if (!i) return;
      var x = d(i.value);
      i.value = f(x);
      if (x.length === 6 && x !== OK)
        show(i, "Неверный код. Проверьте SMS и попробуйте ещё раз");
    },
    true,
  );
  document.addEventListener(
    "click",
    function (ev) {
      var b =
        ev.target && ev.target.closest
          ? ev.target.closest(".auth_register_code .auth_button_next")
          : null;
      if (!b) return;
      var i = q(),
        x = d(i ? i.value : "");
      if (x.length !== 6 || x !== OK) {
        show(
          i,
          x.length === 6
            ? "Неверный код. Проверьте SMS и попробуйте ещё раз"
            : "Введите корректный код",
        );
        ev.preventDefault();
        ev.stopPropagation();
        if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
      }
    },
    true,
  );
  document.addEventListener(
    "click",
    function (ev) {
      var b =
        ev.target && ev.target.closest
          ? ev.target.closest(
              ".auth_register_code .auth_button_resend,.auth_register_code .auth_code_change",
            )
          : null;
      if (!b) return;
      var i = q();
      if (i) hide(i);
    },
    true,
  );
  init();
  new MutationObserver(init).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
});

/* =========================================================
   LK CERTIFICATES: LOAD CERTIFICATES BY IIN

   Страница:
   /lk-certificates

   Что делает:
   - ждёт Memberstack;
   - берёт ИИН из custom field iin или из email до @protectplus.local;
   - отправляет ИИН в Make;
   - получает список сертификатов;
   - клонирует готовую строку Certificate_row из Webflow;
   - заполняет Certificate_name, Certificate_meta, Certificate_status.
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
  const MAKE_GET_CERTIFICATES_URL = 'https://hook.eu1.make.com/9jyx1a3gfxfs9peu9gozhguzaziqxdtw';

  const certificatesList = document.querySelector('.certificates_list');

  if (!certificatesList) {
    return;
  }

  const templateRow = certificatesList.querySelector('.certificate_row');

  if (!templateRow) {
    console.warn('Certificate template row not found');
    return;
  }

  const certificateTemplate = templateRow.cloneNode(true);

  function getDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function formatDate(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function getStatusText(status) {
    const map = {
      active: 'Активен',
      expired: 'Истёк',
      exchanged: 'Обменян',
      returned: 'Возвращён',
      review: 'На рассмотрении'
    };

    return map[String(status || '').toLowerCase()] || status || '—';
  }

  function setTextAll(row, selector, text) {
    row.querySelectorAll(selector).forEach(function (element) {
      element.textContent = text;
    });
  }

  function clearList() {
    certificatesList.innerHTML = '';
  }

  function renderMessage(message) {
    clearList();

    const row = certificateTemplate.cloneNode(true);

    setTextAll(row, '.certificate_name', message);
    setTextAll(row, '.certificate_meta', '');
    setTextAll(row, '.certificate_status', '');

    row.removeAttribute('href');
    row.style.cursor = 'default';

    certificatesList.appendChild(row);
  }

  function renderCertificates(items) {
    clearList();

    if (!items || !items.length) {
      renderMessage('Сертификаты не найдены');
      return;
    }

    items.forEach(function (item) {
      const row = certificateTemplate.cloneNode(true);

      const certificateNumber = item.certificate_number || '';
      const brand = item.brand || '';
      const model = item.model || '';
      const validUntil = formatDate(item.valid_until);
      const statusText = getStatusText(item.status);

      let title = '';

if (model && brand && model.toLowerCase().includes(brand.toLowerCase())) {
  title = model;
} else {
  title = [brand, model].filter(Boolean).join(' ');
}

if (!title) {
  title = 'Сертификат';
}

      const meta = certificateNumber
        ? '№ ' + certificateNumber + (validUntil ? ' · действует до ' + validUntil : '')
        : validUntil
          ? 'Действует до ' + validUntil
          : '';

      setTextAll(row, '.certificate_name', title);
      setTextAll(row, '.certificate_meta', meta);
      setTextAll(row, '.certificate_status', statusText);

      row.dataset.certificateNumber = certificateNumber;

      const detailUrl = '/lk-certificate?series=' + encodeURIComponent(certificateNumber);

      if (row.tagName && row.tagName.toLowerCase() === 'a') {
        row.setAttribute('href', detailUrl);
      } else {
        row.style.cursor = 'pointer';

        row.addEventListener('click', function () {
          if (certificateNumber) {
            window.location.href = detailUrl;
          }
        });
      }

      certificatesList.appendChild(row);
    });
  }

  function getCustomField(member, keys) {
    const customFields =
      member.customFields ||
      member.custom_fields ||
      member.profile ||
      {};

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];

      if (customFields && customFields[key]) {
        return customFields[key];
      }

      if (member && member[key]) {
        return member[key];
      }
    }

    return '';
  }

  function getMemberEmail(member) {
    return (
      member.email ||
      (member.auth && member.auth.email) ||
      (member.profile && member.profile.email) ||
      ''
    );
  }

  function getIinFromEmail(email) {
    const value = String(email || '');
    const beforeAt = value.split('@')[0];
    const digits = getDigits(beforeAt);

    return digits.length === 12 ? digits : '';
  }

  function waitForMemberstack(attempt) {
    const currentAttempt = attempt || 1;

    return new Promise(function (resolve, reject) {
      if (window.$memberstackDom && window.$memberstackDom.getCurrentMember) {
        resolve();
        return;
      }

      if (currentAttempt >= 30) {
        reject(new Error('Memberstack is not ready'));
        return;
      }

      setTimeout(function () {
        waitForMemberstack(currentAttempt + 1).then(resolve).catch(reject);
      }, 200);
    });
  }

  function getCurrentMemberIin() {
    return waitForMemberstack()
      .then(function () {
        return window.$memberstackDom.getCurrentMember();
      })
      .then(function (result) {
        const member = result && result.data ? result.data : null;

        if (!member) {
          throw new Error('Member is not logged in');
        }

        let iin = getCustomField(member, [
          'iin',
          'IIN'
        ]);

        iin = getDigits(iin);

        if (iin.length === 12) {
          return iin;
        }

        const email = getMemberEmail(member);
        const iinFromEmail = getIinFromEmail(email);

        if (iinFromEmail) {
          return iinFromEmail;
        }

        throw new Error('IIN not found in Memberstack member');
      });
  }

  function loadCertificatesByIin(iin) {
    return fetch(MAKE_GET_CERTIFICATES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        iin: iin
      })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || data.ok === false) {
          throw new Error(data && data.message ? data.message : 'Certificates loading error');
        }

        return data.data || [];
      });
  }

  function bootCertificatesPage() {
    renderMessage('Загружаем сертификаты...');

    getCurrentMemberIin()
      .then(function (iin) {
        console.log('LK certificates IIN:', iin);
        return loadCertificatesByIin(iin);
      })
      .then(function (items) {
        console.log('LK certificates loaded:', items);
        renderCertificates(items);
      })
      .catch(function (error) {
        console.error('Certificates page error:', error);
        renderMessage('Не удалось загрузить сертификаты');
      });
  }

  const refreshButton = document.querySelector('.certificates_refresh');

  if (refreshButton) {
    refreshButton.addEventListener('click', function (event) {
      event.preventDefault();
      bootCertificatesPage();
    });
  }

  bootCertificatesPage();
});

/* =========================================================
   LK CERTIFICATE DETAIL: LOAD CERTIFICATE BY SERIES

   Страница:
   /lk-certificate?series=C202606281410001073

   Что делает:
   - берёт series из URL;
   - отправляет series в Make;
   - получает карточку сертификата;
   - заполняет строки в Certificate_details_card.
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
  const MAKE_GET_CERTIFICATE_URL = 'https://hook.eu1.make.com/t7ss7ml3ximidk1worwquuqekbxaux8t';

  const detailsCard = document.querySelector('.certificate_details_card');

  if (!detailsCard) {
    return;
  }

  function getParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name) || '';
  }

  function formatDate(value) {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  function getStatusText(status) {
    const map = {
      active: 'Активен',
      expired: 'Истёк',
      exchanged: 'Обменян',
      returned: 'Возвращён',
      review: 'На рассмотрении'
    };

    return map[String(status || '').toLowerCase()] || status || '—';
  }

  function normalizeLabel(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/[:：]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function setValueByLabel(labelText, value) {
    const targetLabel = normalizeLabel(labelText);
    const rows = detailsCard.querySelectorAll('.certificate_data_row');

    rows.forEach(function (row) {
      const label = row.querySelector('.certificate_data_label');
      const valueElement = row.querySelector('.certificate_data_value');

      if (!label || !valueElement) return;

      if (normalizeLabel(label.textContent) === targetLabel) {
        valueElement.textContent = value || '—';
      }
    });
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(function (element) {
      element.textContent = value || '—';
    });
  }

  function loadCertificate(series) {
    return fetch(MAKE_GET_CERTIFICATE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        series: series
      })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || data.ok === false) {
          throw new Error(data && data.message ? data.message : 'Certificate loading error');
        }

        return data.data || {};
      });
  }

  function renderCertificate(item) {
    const certificateNumber = item.certificate_number || '';
    const certificateType = item.certificate_type || '';
    const saleType = item.sale_type || '';
    const validUntil = formatDate(item.valid_until);
    const statusText = getStatusText(item.status);
    const category = item.category || '';
    const brand = item.brand || '';
    const model = item.model || '';
    const imei = item.imei || '';

    const title = model || [brand, category].filter(Boolean).join(' ') || 'Сертификат';

    setText('.certificate_hero_title', title);
    setText('.certificate_status', statusText);

    setValueByLabel('Номер сертификата', certificateNumber);
    setValueByLabel('Тип сертификата', certificateType);
    setValueByLabel('Тип продажи', saleType);
    setValueByLabel('Действителен до', validUntil);

    setValueByLabel('Категория', category);
    setValueByLabel('Бренд', brand);
    setValueByLabel('Модель', model);
    setValueByLabel('IMEI', imei);
  }

  function renderLoading() {
    setText('.certificate_hero_title', 'Загружаем сертификат...');
    setText('.certificate_status', '—');
  }

  function renderError() {
    setText('.certificate_hero_title', 'Не удалось загрузить сертификат');
    setText('.certificate_status', '—');
  }

  function bootCertificatePage() {
    const series = getParam('series');

    if (!series) {
      renderError();
      console.warn('Certificate series param not found');
      return;
    }

    renderLoading();

    loadCertificate(series)
      .then(function (item) {
        console.log('LK certificate loaded:', item);
        renderCertificate(item);
      })
      .catch(function (error) {
        console.error('Certificate detail page error:', error);
        renderError();
      });
  }

  bootCertificatePage();
});

/* =========================================================
   LK SUMMARY: CERTIFICATES AND COUPONS COUNTS

   Страница:
   /lk

   Что делает:
   - ждёт Memberstack;
   - берёт ИИН текущего пользователя;
   - отправляет ИИН в Make;
   - получает certificates и coupons;
   - выводит количество сертификатов и купонов.
   ========================================================= */

document.addEventListener('DOMContentLoaded', function () {
  const MAKE_LK_SUMMARY_URL = 'https://hook.eu1.make.com/ul3k5asmsea33pkz1lgi560nz7t84p0d';

  const certificatesCountElement = document.querySelector('.account_certificates_count');
  const couponsCountElement = document.querySelector('.account_coupons_count');

  if (!certificatesCountElement && !couponsCountElement) {
    return;
  }

  function getDigits(value) {
    return String(value || '').replace(/\D/g, '');
  }

  function setText(element, value) {
    if (!element) return;
    element.textContent = value;
  }

  function setLoading() {
    setText(certificatesCountElement, '...');
    setText(couponsCountElement, '...');
  }

  function setError() {
    setText(certificatesCountElement, '—');
    setText(couponsCountElement, '—');
  }

  function getCustomField(member, keys) {
    const customFields =
      member.customFields ||
      member.custom_fields ||
      member.profile ||
      {};

    for (let i = 0; i < keys.length; i += 1) {
      const key = keys[i];

      if (customFields && customFields[key]) {
        return customFields[key];
      }

      if (member && member[key]) {
        return member[key];
      }
    }

    return '';
  }

  function getMemberEmail(member) {
    return (
      member.email ||
      (member.auth && member.auth.email) ||
      (member.profile && member.profile.email) ||
      ''
    );
  }

  function getIinFromEmail(email) {
    const beforeAt = String(email || '').split('@')[0];
    const digits = getDigits(beforeAt);

    return digits.length === 12 ? digits : '';
  }

  function waitForMemberstack(attempt) {
    const currentAttempt = attempt || 1;

    return new Promise(function (resolve, reject) {
      if (window.$memberstackDom && window.$memberstackDom.getCurrentMember) {
        resolve();
        return;
      }

      if (currentAttempt >= 30) {
        reject(new Error('Memberstack is not ready'));
        return;
      }

      setTimeout(function () {
        waitForMemberstack(currentAttempt + 1).then(resolve).catch(reject);
      }, 200);
    });
  }

  function getCurrentMemberIin() {
    return waitForMemberstack()
      .then(function () {
        return window.$memberstackDom.getCurrentMember();
      })
      .then(function (result) {
        const member = result && result.data ? result.data : null;

        if (!member) {
          throw new Error('Member is not logged in');
        }

        let iin = getCustomField(member, ['iin', 'IIN']);
        iin = getDigits(iin);

        if (iin.length === 12) {
          return iin;
        }

        const email = getMemberEmail(member);
        const iinFromEmail = getIinFromEmail(email);

        if (iinFromEmail) {
          return iinFromEmail;
        }

        throw new Error('IIN not found in Memberstack member');
      });
  }

  function loadLkSummary(iin) {
    return fetch(MAKE_LK_SUMMARY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        iin: iin
      })
    })
      .then(function (response) {
        return response.json();
      })
      .then(function (data) {
        if (!data || data.ok === false) {
          throw new Error(data && data.message ? data.message : 'LK summary loading error');
        }

        return data;
      });
  }

  function getCount(value) {
    if (Array.isArray(value)) {
      return value.length;
    }

    if (typeof value === 'number') {
      return value;
    }

    if (typeof value === 'string' && value.trim() !== '') {
      const numberValue = Number(value);

      if (!Number.isNaN(numberValue)) {
        return numberValue;
      }
    }

    return 0;
  }

  function renderSummary(data) {
    const certificatesCount = getCount(data.certificates || data.certificates_count);
    const couponsCount = getCount(data.coupons || data.coupons_count);

    setText(certificatesCountElement, certificatesCount);
    setText(couponsCountElement, couponsCount);
  }

  function bootLkSummary() {
    setLoading();

    getCurrentMemberIin()
      .then(function (iin) {
        console.log('LK summary IIN:', iin);
        return loadLkSummary(iin);
      })
      .then(function (data) {
        console.log('LK summary loaded:', data);
        renderSummary(data);
      })
      .catch(function (error) {
        console.error('LK summary error:', error);
        setError();
      });
  }

  bootLkSummary();
});
