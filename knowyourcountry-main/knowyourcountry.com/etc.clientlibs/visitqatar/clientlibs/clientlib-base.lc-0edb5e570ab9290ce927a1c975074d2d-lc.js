/*******************************************************************************
 * Copyright 2018 Adobe
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 ******************************************************************************/
(function () {
    'use strict';

    var initInterval = 500;

    var initialTouchX = null;
    var initialTouchY = null;
    var touchDifferenceX = null;
    var touchDifferenceY = null;

    var direction = document.documentElement.hasAttribute('dir') && document.documentElement.getAttribute('dir') === 'rtl' ? 'rtl' : 'ltr';

    var dataLayerEnabled = document.body.hasAttribute('data-cmp-data-layer-enabled');
    var dataLayer = dataLayerEnabled ? (window.adobeDataLayer = window.adobeDataLayer || []) : undefined;

    var NS = 'cmp';
    var IS = 'carousel';

    var keyCodes = {
        SPACE: 32,
        END: 35,
        HOME: 36,
        ARROW_LEFT: 37,
        ARROW_UP: 38,
        ARROW_RIGHT: 39,
        ARROW_DOWN: 40
    };

    var selectors = {
        self: '[data-' + NS + '-is="' + IS + '"]'
    };

    var properties = {
        /**
         * Determines whether the Carousel will automatically transition between slides
         *
         * @memberof Carousel
         * @type {Boolean}
         * @default false
         */
        "autoplay": {
            "default": false,
            "transform": function (value) {
                return !(value === null || typeof value === 'undefined');
            }
        },
        /**
         * Determines whether the Carousel will automatically transition between slides
         *
         * @memberof Carousel
         * @type {String}
         */
        "initial": {
            "default": 'first',
            "transform": function (value) {
                return value;
            }
        },
        /**
         * Duration (in milliseconds) before automatically transitioning to the next slide
         *
         * @memberof Carousel
         * @type {Number}
         * @default 5000
         */
        "delay": {
            "default": 5000,
            "transform": function (value) {
                value = parseFloat(value);
                return !isNaN(value) ? value : null;
            }
        },
        /**
         * Layout
         *
         * @memberof Carousel
         * @type {String}
         * @default landscape
         */
        "layout": {
            "default": 'landscape',
            "transform": function (value) {
                return value;
            }
        },
        /**
         * Determines whether automatic pause on hovering the carousel is disabled
         *
         * @memberof Carousel
         * @type {Boolean}
         * @default false
         */
        "autopauseDisabled": {
            "default": false,
            "transform": function (value) {
                return !(value === null || typeof value === 'undefined');
            }
        },

        "type": {
            "default": ""
        }
    };

    /**
     * Carousel Configuration
     *
     * @typedef {Object} CarouselConfig Represents a Carousel configuration
     * @property {HTMLElement} element The HTMLElement representing the Carousel
     * @property {Object} options The Carousel options
     */

    /**
     * Carousel
     *
     * @class Carousel
     * @classdesc An interactive Carousel component for navigating a list of generic items
     * @param {CarouselConfig} config The Carousel configuration
     */
    function Carousel(config) {
        var that = this;

        if (config && config.element) {
            init(config);
        }

        /**
         * Initializes the Carousel
         *
         * @private
         * @param {CarouselConfig} config The Carousel configuration
         */
        function init(config) {
            // prevents multiple initialization
            config.element.removeAttribute('data-' + NS + '-is');

            setupProperties(config.options);
            cacheElements(config.element);
            cacheItemSizes();

            var initialSlide = undefined;
            var userCountryCode = window.sessionStorage.getItem('qntc-country');
            var slides = that._elements.item;

            // get initial slide from primary country defined on a card
            if (userCountryCode && userCountryCode.length > 0 && that._properties.layout === 'portrait-one') {
                const slideIndex = getReturningCustomerCardIndex(userCountryCode, slides);

                initialSlide = slideIndex >= 0 ? slideIndex : initialSlide;
            }

            // When no initial slide was found based on the country , get initial slide from center or from urlparam
            if (initialSlide === undefined) {
                initialSlide = getInitialSlide();
            }

            that._active = initialSlide;
            that._paused = false;
            that._slidesInView = 1;
            that._totalSlides = 0;

            if (that._elements.item) {
                that._totalSlides = that._elements['item'].length > 1 ? that._elements['item'].length : 1;
                refreshSlidesInView();
                refreshActive();
                bindEvents();
                resetAutoplayInterval();
                refreshPlayPauseActions();

                var isVisible = false;
                var observer = new IntersectionObserver(
                    function (entries) {
                        entries.forEach(function (entry) {
                            if (entry.isIntersecting) {
                                cacheItemSizes();
                                isVisible = true;
                            } else isVisible = false;
                        });
                    },
                    { root: document.body }
                );
                observer.observe(that._elements.self);

                setInterval(function () {
                    if (!isVisible) return;
                    if (!initialTouchX && !initialTouchY) {
                        refreshSlidesInView();
                    }
                }, 500);
            }
        }

        function getReturningCustomerCardIndex(userCountryCode, slides) {
            var cards = slides.map(getCard);

            // If this is a returning visitor
            if (isReturningVisitor()) {
                var preferredDemandSpace = getPreferredDemandSpace();
                var preferredDemandSpaceIndex = getPreferredDemandSpaceIndex(preferredDemandSpace, cards);

                // If this returning visitor has a preferred demand space in localstorage (qntc-ds-counter)
                if (preferredDemandSpaceIndex >= 0) {
                    return preferredDemandSpaceIndex;
                }

                // If country of visitor is defined as secondary country on a card
                var secondaryCountryIndex = getCountryIndex(userCountryCode, cards, 'secondaryCountries');
                if (secondaryCountryIndex >= 0) {
                    return secondaryCountryIndex;
                }
            }

            // If country of visitor is defined as primary country on a card
            var primaryCountryIndex = getCountryIndex(userCountryCode, cards, 'primaryCountries');
            if (primaryCountryIndex >= 0) {
                return primaryCountryIndex;
            }

            return -1;
        }

        function getCard(slide) {
            return slide.querySelector('.cmp-card');
        }

        function getCountryIndex(userCountryCode, cards, dataKey) {
            return cards.findIndex(function (card) {
                var countries = card.dataset[dataKey];

                if (!countries) return;

                return getCountryCodes(countries).some(function (code) {
                    return code === userCountryCode;
                });
            });
        }

        function getPreferredDemandSpace() {
            var dsCounter = getDsCounter();
            var dsCounterKeys = Object.keys(dsCounter);

            if (dsCounterKeys.length > 0) {
                return dsCounterKeys.reduce(function (a, b) {
                    return dsCounter[a] > dsCounter[b] ? a : b;
                });
            }

            return '';
        }

        function getPreferredDemandSpaceIndex(preferredDemandSpace, cards) {
            return cards.findIndex(function (card) {
                return card.dataset.cmpDemandSpaceName === preferredDemandSpace;
            });
        }

        function isReturningVisitor() {
            var now = Date.now().toString();
            var keyReturningVisitor = 'qntc-returning-visitor';
            var sessionStorageStart = sessionStorage.getItem(keyReturningVisitor);
            var localStorageStart = localStorage.getItem(keyReturningVisitor);

            if (!sessionStorageStart) {
                sessionStorage.setItem(keyReturningVisitor, now);
            }

            if (!localStorageStart) {
                localStorage.setItem(keyReturningVisitor, now);
            }

            return localStorage.getItem(keyReturningVisitor) !== sessionStorage.getItem(keyReturningVisitor);
        }

        function getDsCounter() {
            var dsCounterString = localStorage.getItem('qntc-ds-counter');
            return dsCounterString ? JSON.parse(dsCounterString) : {};
        }

        // Get initial slide (start, center, or from ds url parameter
        function getInitialSlide() {
            var initial = 0;

            if (that._properties.initial === 'center') {
                initial = Math.floor(that._elements['item'].length / 2);

                if (that._properties.layout === 'portrait' && window.matchMedia('(min-width: 768px)').matches) {
                    initial--;
                }

                if (that._elements['item'].length % 2 === 0) {
                    initial--;
                }
            }

            return initial;
        }

        function getCountryCodes(countries) {
            var parsedCountries = [];
            if (countries) {
                var countries = countries.split(',');
                countries.forEach(function (country) {
                    parsedCountries.push(country.replace('visitqatar:country/', '').toUpperCase());
                });
            }

            return parsedCountries;
        }

        /**
         * Caches the Carousel elements as defined via the {@code data-carousel-hook="ELEMENT_NAME"} markup API
         *
         * @private
         * @param {HTMLElement} wrapper The Carousel wrapper element
         */
        function cacheElements(wrapper) {
            that._elements = {};
            that._elements.self = wrapper;
            var hooks = that._elements.self.querySelectorAll('[data-' + NS + '-hook-' + IS + ']');

            for (var i = 0; i < hooks.length; i++) {
                var hook = hooks[i];
                var capitalized = IS;
                capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
                var key = hook.dataset[NS + 'Hook' + capitalized];
                if (that._elements[key]) {
                    if (!Array.isArray(that._elements[key])) {
                        var tmp = that._elements[key];
                        that._elements[key] = [tmp];
                    }
                    that._elements[key].push(hook);
                } else {
                    that._elements[key] = hook;
                }
            }
        }

        function cacheItemSizes() {
            if (that._properties.layout.indexOf('auto') > -1) {
                that._itemSizes = that._elements['item'].map(function (item) {
                    return item.getBoundingClientRect().width;
                });
            }
        }

        function getTotalSlideWidth(startingFrom) {
            return that._itemSizes.slice(startingFrom).reduce(function (acc, w) { return acc + w; }, 0);
        }

        function isFirstSlide() {
            return that._active === 0;
        }

        function isLastSlide() {
            return that._active === that._totalSlides - that._slidesInView;
        }

        /**
         * Sets up properties for the Carousel based on the passed options.
         *
         * @private
         * @param {Object} options The Carousel options
         */
        function setupProperties(options) {
            that._properties = {};

            for (var key in properties) {
                if (properties.hasOwnProperty(key)) {
                    var property = properties[key];
                    var value = null;

                    if (options && options[key] != null) {
                        value = options[key];

                        // transform the provided option
                        if (property && typeof property.transform === 'function') {
                            value = property.transform(value);
                        }
                    }

                    if (value === null) {
                        // value still null, take the property default
                        value = properties[key]['default'];
                    }

                    that._properties[key] = value;
                }
            }
        }

        /**
         * Binds Carousel event handling
         *
         * @private
         */
        function bindEvents() {
            if (that._totalSlides > 1) {
                var myElement = that._elements['content'];

                myElement.addEventListener('touchstart', startTouch, false);
                myElement.addEventListener('touchmove', moveTouch, false);
                myElement.addEventListener('touchend', endTouch, false);
                myElement.addEventListener('touchcancel', cancelTouch, false);

                that._elements.self.addEventListener('carouselnavigate', function (e) {
                    if (e.detail && e.detail.index !== undefined) {
                        navigate(e.detail.index);
                    }
                });

                if (that._elements['previous']) {
                    that._elements['previous'].addEventListener('click', function (e) {
                        if (e.currentTarget.disabled) return;
                        var index = getPreviousIndex();
                        navigate(index);
                        if (e.pointerType !== 'touch') addActiveClass(e.currentTarget);
                        if (dataLayerEnabled && that._elements.item[index].dataset.cmpDataLayer) {
                            dataLayer.push({
                                component: JSON.parse(that._elements.item[index].dataset.cmpDataLayer),
                                event: 'cmp:show:carousel/item',
                                eventInfo: {
                                    path: 'component.' + getDataLayerId(that._elements.item[index].dataset.cmpDataLayer)
                                }
                            });
                        }
                    });
                }

                if (that._elements['next']) {
                    that._elements['next'].addEventListener('click', function (e) {
                        if (e.currentTarget.disabled) return;
                        var index = getNextIndex();
                        navigate(index);
                        if (e.pointerType !== 'touch') addActiveClass(e.currentTarget);
                        if (dataLayerEnabled && that._elements.item[index].dataset.cmpDataLayer) {
                            dataLayer.push({
                                component: JSON.parse(that._elements.item[index].dataset.cmpDataLayer),
                                event: 'cmp:show:carousel/item',
                                eventInfo: {
                                    path: 'component.' + getDataLayerId(that._elements.item[index].dataset.cmpDataLayer)
                                }
                            });
                        }
                    });
                }

                var indicators = that._elements['indicator'];
                if (indicators) {
                    for (var i = 0; i < indicators.length; i++) {
                        (function (index) {
                            indicators[i].addEventListener('click', function () {
                                navigateAndFocusIndicator(index);
                            });
                        })(i);
                    }
                }

                if (that._elements['pause']) {
                    if (that._properties.autoplay) {
                        that._elements['pause'].addEventListener('click', onPauseClick);
                    }
                }

                if (that._elements['play']) {
                    if (that._properties.autoplay) {
                        that._elements['play'].addEventListener('click', onPlayClick);
                    }
                }

                that._elements.self.addEventListener('keydown', onKeyDown);

                if (!that._properties.autopauseDisabled) {
                    that._elements.self.addEventListener('mouseenter', onMouseEnter);
                    that._elements.self.addEventListener('mouseleave', onMouseLeave);
                }

                window.addEventListener('resize', cacheItemSizes);
            }
        }

        function startTouch(e) {
            refreshSlidesInView();
            that._elements['slides'].setAttribute('data-touched', 'true');
            initialTouchX = e.touches[0].clientX;
            initialTouchY = e.touches[0].clientY;

            // hide play when touched
            if (that._elements['play']) {
                that._elements['play'].setAttribute('aria-hidden', true);
                onPauseClick();
            }
        }

        function moveTouch(e) {
            if (initialTouchX === null || initialTouchY === null) {
                cancelTouch(e);
            }

            touchDifferenceX = initialTouchX - e.touches[0].clientX;
            touchDifferenceY = initialTouchY - e.touches[0].clientY;

            if (Math.abs(touchDifferenceX) > Math.abs(touchDifferenceY) && e.cancelable) {
                // horizontal scroll
                var transform = null;
                if (that._properties.layout.indexOf('auto') >= 0) {
                    var slidesWidth = that._elements['slides'].clientWidth;
                    var contentWidth = that._elements['content'].clientWidth;
                    var item = that._elements['item'][that._active];
                    var offset = 0;

                    if (isLastSlide() && that._properties.layout !== 'auto-align') {
                        // aligning to the right
                        offset = getTotalSlideWidth(0) - slidesWidth;
                    } else {
                        offset = direction === 'rtl'
                            ? item.offsetParent.clientWidth - item.offsetLeft - item.offsetWidth
                            : item.offsetLeft;
                    }

                    if (that._properties.layout === 'auto-align' && window.matchMedia('(max-width: 999px)').matches) {
                        if (isLastSlide()) {
                            offset -= contentWidth - item.offsetWidth;
                        } else if (!isFirstSlide()) {
                            offset -= (contentWidth - item.offsetWidth) / 2
                        }
                    }

                    transform = 100 * offset / slidesWidth;
                } else {
                    transform = that._active * 100 / that._slidesInView;
                }
                that._elements['slides'].style.transform =
                  'translate3d(calc(' +
                  (direction === 'rtl' ? '' : '-') +
                  transform.toPrecision(2) +
                  '% - ' +
                  Math.floor(touchDifferenceX) +
                  'px), 0, 0)';
                e.preventDefault();
            } else {
                return;
            }
        }

        function endTouch(e) {
            // sliding horizontally
            if (Math.abs(touchDifferenceX) > Math.abs(touchDifferenceY) && e.cancelable) {
                var switchDirection = direction === 'rtl' && that._properties.layout.indexOf('auto') > -1;
                var goToNext = switchDirection ? touchDifferenceX <= 0 : touchDifferenceX >= 0;
                that._active = goToNext ? getNextIndex() : getPreviousIndex();
                e.preventDefault();
            }

            cancelTouch(e);
        }

        function cancelTouch(e) {
            that._elements['slides'].removeAttribute('data-touched');

            initialTouchX = null;
            initialTouchY = null;
            touchDifferenceX = null;
            touchDifferenceY = null;

            navigate(that._active);

            return;
        }

        /**
         * Handles carousel keydown events
         *
         * @private
         * @param {Object} event The keydown event
         */
        function onKeyDown(event) {
            var index = that._active;
            var lastIndex = that._elements['indicator'].length - 1;

            switch (event.keyCode) {
                case keyCodes.ARROW_LEFT:
                case keyCodes.ARROW_UP:
                    event.preventDefault();
                    if (index > 0) {
                        navigateAndFocusIndicator(index - 1);
                    }
                    break;
                case keyCodes.ARROW_RIGHT:
                case keyCodes.ARROW_DOWN:
                    event.preventDefault();
                    if (index < lastIndex) {
                        navigateAndFocusIndicator(index + 1);
                    }
                    break;
                case keyCodes.HOME:
                    event.preventDefault();
                    navigateAndFocusIndicator(0);
                    break;
                case keyCodes.END:
                    event.preventDefault();
                    navigateAndFocusIndicator(lastIndex);
                    break;
                case keyCodes.SPACE:
                    if (
                        that._properties.autoplay &&
                        event.target !== that._elements['previous'] &&
                        event.target !== that._elements['next']
                    ) {
                        event.preventDefault();
                        if (!that._paused) {
                            pause();
                        } else {
                            play();
                        }
                    }
                    if (event.target === that._elements['pause']) {
                        that._elements['play'].focus();
                    }
                    if (event.target === that._elements['play']) {
                        that._elements['pause'].focus();
                    }
                    break;
                default:
                    return;
            }
        }

        /**
         * Handles carousel mouseenter events
         *
         * @private
         * @param {Object} event The mouseenter event
         */
        function onMouseEnter(event) {
            clearAutoplayInterval();
        }

        /**
         * Handles carousel mouseleave events
         *
         * @private
         * @param {Object} event The mouseleave event
         */
        function onMouseLeave(event) {
            resetAutoplayInterval();
        }

        /**
         * Handles pause element click events
         *
         * @private
         * @param {Object} event The click event
         */
        function onPauseClick(event) {
            pause();
            that._elements['play'].focus();
        }

        /**
         * Handles play element click events
         *
         * @private
         * @param {Object} event The click event
         */
        function onPlayClick() {
            play();
            that._elements['pause'].focus();
        }

        /**
         * Pauses the playing of the Carousel. Sets {@code Carousel#_paused} marker.
         * Only relevant when autoplay is enabled
         *
         * @private
         */
        function pause() {
            that._paused = true;
            clearAutoplayInterval();
            refreshPlayPauseActions();
        }

        /**
         * Enables the playing of the Carousel. Sets {@code Carousel#_paused} marker.
         * Only relevant when autoplay is enabled
         *
         * @private
         */
        function play() {
            that._paused = false;

            // If the Carousel is hovered, don't begin auto transitioning until the next mouse leave event
            var hovered = false;
            if (that._elements.self.parentElement) {
                hovered = that._elements.self.parentElement.querySelector(':hover') === that._elements.self;
            }
            if (that._properties.autopauseDisabled || !hovered) {
                resetAutoplayInterval();
            }

            refreshPlayPauseActions();
        }

        /**
         * Refreshes the play/pause action markup based on the {@code Carousel#_paused} state
         *
         * @private
         */
        function refreshPlayPauseActions() {
            setActionDisabled(that._elements['pause'], that._paused);
            setActionDisabled(that._elements['play'], !that._paused);
        }

        /**
         * Refreshes the item markup based on the current {@code Carousel#_active} index
         *
         * @private
         */
        function refreshSlidesInView() {
            var items = that._elements['item'];
            if (items && items.length > 1 && that._elements['indicator']) {
                if (that._properties.layout.indexOf('auto') === -1) {
                    that._slidesInView = Math.round(that._elements.self.clientWidth / items[0].clientWidth);
                }

                if (that._properties.layout === 'auto' && !isLastSlide()) {
                    if (getTotalSlideWidth(that._active) <= that._elements['content'].offsetWidth) {
                        // empty space at the end, move to previous item
                        navigate(getPreviousIndex());
                        return;
                    }
                }

                // loop to previous index
                if (
                    that._properties.layout !== 'portrait-one' &&
                    that._properties.layout.indexOf('auto') === -1 &&
                    items.length - that._active - that._slidesInView < 0 &&
                    !(items.length === that._slidesInView)
                ) {
                    that._active = getPreviousIndex();
                    navigate(that._active);
                    return;
                }

                // When not all slides are in view
                if (items.length - that._slidesInView > 0) {
                    navigate(that._active);

                    that._elements.self.classList.add('cmp-carousel--show-controls');

                    // hide or show indicators
                    for (var i = that._elements['indicator'].length - 1; i >= 0; i--) {
                        if (items.length - i - that._slidesInView < 0) {
                            that._elements['indicator'][i].classList.add('cmp-carousel__indicator--hidden');
                        } else {
                            that._elements['indicator'][i].classList.remove('cmp-carousel__indicator--hidden');
                        }
                    }
                }

                // Hide controls when all slides are in view
                else {
                    that._elements.self.classList.remove('cmp-carousel--show-controls');
                }
            }
        }

        /**
         * Refreshes the item markup based on the current {@code Carousel#_active} index
         *
         * @private
         */
        function refreshActive() {
            var items = that._elements['item'];
            var indicators = that._elements['indicator'];

            if (items && indicators) {
                if (Array.isArray(items)) {
                    var allSlidesInView = that._totalSlides === that._slidesInView;

                    for (var i = 0; i < items.length; i++) {
                        if (!allSlidesInView) {
                            items[i].removeAttribute('style');
                        }

                        if (i === parseInt(that._active)) {
                            items[i].classList.add('cmp-carousel__item--active');
                            indicators[i].classList.add('cmp-carousel__indicator--active');
                            indicators[i].setAttribute('aria-selected', true);
                            indicators[i].setAttribute('tabindex', '0');
                            if (allSlidesInView && that._properties.layout === 'portrait-one') {
                                var evenNumber = that._slidesInView % 2 !== 0 ? that._slidesInView + 1 : that._slidesInView;
                                items[i].style.order = i < evenNumber / 2 ? evenNumber + 1 : evenNumber - 1;
                            }
                        } else {
                            items[i].classList.remove('cmp-carousel__item--active');
                            indicators[i].classList.remove('cmp-carousel__indicator--active');
                            indicators[i].setAttribute('aria-selected', false);
                            indicators[i].setAttribute('tabindex', '-1');
                            if (allSlidesInView && that._properties.layout === 'portrait-one') {
                                items[i].style.order = (i + 1) * 2;
                            }
                        }
                    }

                    if (that._properties.type === 'roller') {
                        that._elements['previous'].disabled = isFirstSlide();
                        that._elements['next'].disabled = getNextIndex() === 0;
                    }
                } else {
                    // only one item
                    items.classList.add('cmp-carousel__item--active');
                    indicators.classList.add('cmp-carousel__indicator--active');
                }
            }
        }

        /**
         * Focuses the element and prevents scrolling the element into view
         *
         * @param {HTMLElement} element Element to focus
         */
        function focusWithoutScroll(element) {
            var x = window.scrollX || window.pageXOffset;
            var y = window.scrollY || window.pageYOffset;
            element.focus();
            window.scrollTo(x, y);
        }

        /**
         * Retrieves the next active index, with looping
         * If layout is auto, indexes are kept in order from smallest to largest
         *
         * @private
         * @returns {Number} Index of the next carousel item
         */
        function getNextIndex() {
            if (direction === 'rtl' && that._properties.layout.indexOf('auto') === -1) {
                if (that._properties.layout === 'portrait-one') {
                    return isFirstSlide() ? that._totalSlides - 1 : that._active - 1;
                }
                return isFirstSlide() ? that._totalSlides - that._slidesInView : that._active - 1;
            } else {
                if (that._properties.layout === 'portrait-one') {
                    return that._active === that._totalSlides - 1 ? 0 : that._active + 1;
                } else if (that._properties.layout === 'auto' && !isLastSlide()) {
                    var carouselWindowWidth = that._elements['content'].offsetWidth;

                    if (getTotalSlideWidth(0) <= carouselWindowWidth) {
                        // all slides already fit, so no navigation should happen
                        return 0;
                    }

                    var nextIndex = that._active + 1;
                    if (getTotalSlideWidth(nextIndex) <= carouselWindowWidth) {
                        // will have empty space at the end, align to the end
                        return that._totalSlides - 1;
                    }
                    // safe to navigate
                    return nextIndex;
                }

                return isLastSlide() ? 0 : that._active + 1;
            }
        }

        /**
         * Retrieves the previous active index, with looping
         * If layout is auto, indexes are kept in order from smallest to largest
         *
         * @private
         * @returns {Number} Index of the previous carousel item
         */
        function getPreviousIndex() {
            if (direction === 'rtl' && that._properties.layout.indexOf('auto') === -1) {
                if (that._properties.layout === 'portrait-one') {
                    return that._active === that._totalSlides - 1 ? 0 : that._active + 1;
                }

                return isLastSlide() ? 0 : that._active + 1;
            } else {
                if (that._properties.layout === 'portrait-one') {
                    return isFirstSlide() ? that._totalSlides - 1 : that._active - 1;
                } else if (that._properties.layout === 'auto') {
                    var carouselWindowWidth = that._elements['content'].offsetWidth;
                    if (getTotalSlideWidth(0) <= carouselWindowWidth) {
                        // all slides already fit, so no navigation should happen
                        return 0;
                    }

                    if (!isFirstSlide()) {
                        // searching for the biggest index that will fit all the items without empty space
                        // going from the end
                        var possibleIndex = that._active;
                        var currentWidth = getTotalSlideWidth(possibleIndex);
                        while (possibleIndex > 0) {
                            possibleIndex--;
                            currentWidth += that._itemSizes[possibleIndex];
                            if (currentWidth >= carouselWindowWidth) break;
                        }
                        return possibleIndex;
                    }
                }

                return isFirstSlide() ? that._totalSlides - that._slidesInView : that._active - 1;
            }
        }

        /**
         * Navigates to the item at the provided index
         *
         * @private
         * @param {Number} index The index of the item to navigate to
         */
        function navigate(index) {
            if (index < 0 || index > that._totalSlides - 1 || that._totalSlides <= 1) {
                return;
            }

            that._active = index;
            if (that._totalSlides <= that._slidesInView) {
                that._elements['slides'].style.transform = 'translate3d(0, 0, 0)';
            } else {
                var transform = null;
                if (that._properties.layout.indexOf('auto') >= 0) {
                    var slidesWidth = that._elements['slides'].clientWidth;
                    var contentWidth = that._elements['content'].clientWidth;
                    var item = that._elements['item'][index];
                    var offset = 0;

                    if (isLastSlide() && that._properties.layout !== 'auto-align') {
                        // aligning to the right
                        offset = getTotalSlideWidth(0) - slidesWidth;
                    } else {
                        offset = direction === 'rtl'
                            ? item.offsetParent.clientWidth - item.offsetLeft - item.offsetWidth
                            : item.offsetLeft;
                    }

                    if (that._properties.layout === 'auto-align' && window.matchMedia('(max-width: 999px)').matches) {
                        if (getNextIndex() === 0) {
                            offset -= contentWidth - item.offsetWidth;
                        } else if (index > 0) {
                            offset -= (contentWidth - item.offsetWidth) / 2
                        }
                    }

                    transform = - 100 * offset / slidesWidth;
                } else {
                    transform = that._properties.layout === 'portrait-one'
                      ? (that._active - (that._slidesInView - 1) / 2)
                      : that._active;
                    transform = - transform * 100 / that._slidesInView;
                }

                if (direction === 'rtl') transform = -transform;
                that._elements['slides'].style.transform = 'translate3d(' + transform.toFixed(2) + '%, 0, 0)';
            }

            refreshActive();

            if (dataLayerEnabled && that._elements.item[index].dataset.cmpDataLayer) {
                var carouselId = that._elements.self.id;
                var activeItem = getDataLayerId(that._elements.item[index].dataset.cmpDataLayer);
                var updatePayload = { component: {} };
                updatePayload.component[carouselId] = { shownItems: [activeItem] };

                var removePayload = { component: {} };
                removePayload.component[carouselId] = { shownItems: undefined };

                dataLayer.push(removePayload);
                dataLayer.push(updatePayload);
            }

            // reset the autoplay transition interval following navigation, if not already hovering the carousel
            if (that._elements.self.parentElement) {
                if (that._elements.self.parentElement.querySelector(':hover') !== that._elements.self) {
                    resetAutoplayInterval();
                }
            }

            // resize window to fix blue border box in author mode
            if (window.Granite && window.Granite.author && that._elements['item'].length > 1) {
                setTimeout(function () {
                    window.dispatchEvent(new Event('resize'));
                }, 100);
            }
        }

        /**
         * Navigates to the item at the provided index and ensures the active indicator gains focus
         *
         * @private
         * @param {Number} index The index of the item to navigate to
         */
        function navigateAndFocusIndicator(index) {
            navigate(index);
            focusWithoutScroll(that._elements['indicator'][index]);

            if (dataLayerEnabled && that._elements.item[index].dataset.cmpDataLayer) {
                dataLayer.push({
                    component: JSON.parse(that._elements.item[index].dataset.cmpDataLayer),
                    event: 'cmp:show:carousel/item',
                    eventInfo: {
                        path: 'component.' + getDataLayerId(that._elements.item[index].dataset.cmpDataLayer)
                    }
                });
            }
        }

        /**
         * Starts/resets automatic slide transition interval
         *
         * @private
         */
        function resetAutoplayInterval() {
            if (that._paused || !that._properties.autoplay) {
                return;
            }
            clearAutoplayInterval();
            that._autoplayIntervalId = window.setInterval(function () {
                if ((document.visibilityState && document.hidden) || document.body.classList.contains('page--pressed-tab')) {
                    return;
                }
                var indicators = that._elements['indicators'];
                if (indicators && indicators !== document.activeElement && indicators.contains(document.activeElement)) {
                    // if an indicator has focus, ensure we switch focus following navigation
                    navigateAndFocusIndicator(getNextIndex());
                } else {
                    navigate(getNextIndex());
                }
            }, that._properties.delay);
        }

        /**
         * Clears/pauses automatic slide transition interval
         *
         * @private
         */
        function clearAutoplayInterval() {
            window.clearInterval(that._autoplayIntervalId);
            that._autoplayIntervalId = null;
        }

        /**
         * Sets the disabled state for an action and toggles the appropriate CSS classes
         *
         * @private
         * @param {HTMLElement} action Action to disable
         * @param {Boolean} [disable] {@code true} to disable, {@code false} to enable
         */
        function setActionDisabled(action, disable) {
            if (!action) {
                return;
            }
            if (disable !== false) {
                action.disabled = true;
                action.classList.add('cmp-carousel__action--disabled');
            } else {
                action.disabled = false;
                action.classList.remove('cmp-carousel__action--disabled');
            }
        }

        /**
         * Add 'pressed' class to the last clicked button (unless it's the first or the last slide)
         * @param {HTMLButtonElement} button
         */
        function addActiveClass(button) {
            removeButtonActiveClass();
            that._elements['previous'].classList.remove('cmp-carousel__action--pressed');
            that._elements['next'].classList.remove('cmp-carousel__action--pressed');

            if (getNextIndex() === 0) {
                that._elements['previous'].classList.add('cmp-carousel__action--pressed');
            } else if (isFirstSlide()) {
                that._elements['next'].classList.add('cmp-carousel__action--pressed');
            } else {
                button.classList.add('cmp-carousel__action--pressed');
            }

            requestAnimationFrame(function () {
                button.classList.add('cmp-carousel__action--active');
                that._elements['ring'].addEventListener('animationend', removeButtonActiveClass);
                that._elements['ring'].addEventListener('animationcancel', removeButtonActiveClass);
            });
        }

        function removeButtonActiveClass() {
            that._elements['previous'].classList.remove('cmp-carousel__action--active');
            that._elements['next'].classList.remove('cmp-carousel__action--active');
            that._elements['ring'].removeEventListener('animationend', removeButtonActiveClass);
            that._elements['ring'].removeEventListener('animationcancel', removeButtonActiveClass);
        }
    }

    /**
     * Reads options data from the Carousel wrapper element, defined via {@code data-cmp-*} data attributes
     *
     * @private
     * @param {HTMLElement} element The Carousel element to read options data from
     * @returns {Object} The options read from the component data attributes
     */
    function readData(element) {
        var data = element.dataset;
        var options = [];
        var capitalized = IS;
        capitalized = capitalized.charAt(0).toUpperCase() + capitalized.slice(1);
        var reserved = ['is', 'hook' + capitalized];

        for (var key in data) {
            if (data.hasOwnProperty(key)) {
                var value = data[key];

                if (key.indexOf(NS) === 0) {
                    key = key.slice(NS.length);
                    key = key.charAt(0).toLowerCase() + key.substring(1);

                    if (reserved.indexOf(key) === -1) {
                        options[key] = value;
                    }
                }
            }
        }

        return options;
    }

    /**
     * Parses the dataLayer string and returns the ID
     *
     * @private
     * @param {String} componentDataLayer the dataLayer string
     * @returns {String} dataLayerId or undefined
     */
    function getDataLayerId(componentDataLayer) {
        return Object.keys(JSON.parse(componentDataLayer))[0];
    }

    /**
     * Document ready handler and DOM mutation observers. Initializes Carousel components as necessary.
     *
     * @private
     */
    function onDocumentReady() {
        var elements = document.querySelectorAll(selectors.self);
        if (elements.length > 0) {
            for (var i = 0; i < elements.length; i++) {
                try {
                    new Carousel({element: elements[i], options: readData(elements[i])});
                } catch (e) {
                    console.error('Unexpected error when creating carousel', elements[i]);
                    console.error(e);
                }
            }

            var MutationObserver = window.MutationObserver || window.WebKitMutationObserver || window.MozMutationObserver;
            var body = document.querySelector('body');
            var observer = new MutationObserver(function (mutations) {
                mutations.forEach(function (mutation) {
                    // needed for IE
                    var nodesArray = [].slice.call(mutation.addedNodes);
                    if (nodesArray.length > 0) {
                        nodesArray.forEach(function (addedNode) {
                            if (addedNode.querySelectorAll) {
                                var elementsArray = [].slice.call(addedNode.querySelectorAll(selectors.self));
                                elementsArray.forEach(function (element) {
                                    try {
                                        new Carousel({element: element, options: readData(element)});
                                    } catch (e) {
                                        console.error('Unexpected error when creating carousel', element);
                                        console.error(e);
                                    }
                                });
                            }
                        });
                    }
                });
            });

            observer.observe(body, {
                subtree: true,
                childList: true,
                characterData: true
            });

        }

        setTimeout( function () {
            onDocumentReady();
        }, initInterval);
    }

    window.addEventListener('load', function() {
        onDocumentReady();
    });
})();

!function(e,t){"object"==typeof exports&&"undefined"!=typeof module?module.exports=t():"function"==typeof define&&define.amd?define(t):(e||self).mapboxStaticMap=t()}(this,function(){function e(e,t){this.request=e,this.headers=t.headers,this.rawBody=t.body,this.statusCode=t.statusCode;try{this.body=JSON.parse(t.body||"{}")}catch(e){this.body=t.body}var r;this.links=(r=this.headers.link)?r.split(/,\s*</).reduce(function(e,t){var r=function(e){var t=e.match(/<?([^>]*)>(.*)/);if(!t)return null;var r=t[1],n=t[2].split(";"),o=null,i=n.reduce(function(e,t){var r=function(e){var t=e.match(/\s*(.+)\s*=\s*"?([^"]+)"?/);return t?{key:t[1],value:t[2]}:null}(t);return r?"rel"===r.key?(o||(o=r.value),e):(e[r.key]=r.value,e):e},{});return o?{url:r,rel:o,params:i}:null}(t);return r?(r.rel.split(/\s+/).forEach(function(t){e[t]||(e[t]={url:r.url,params:r.params})}),e):e},{}):{}}e.prototype.hasNextPage=function(){return!!this.links.next},e.prototype.nextPage=function(){return this.hasNextPage()?this.request._extend({path:this.links.next.url}):null};var t=e,r="RequestAbortedError",n=function(e){var t,n=e.type||"HttpError";if(e.body)try{t=JSON.parse(e.body)}catch(r){t=e.body}else t=null;var o=e.message||null;o||("string"==typeof t?o=t:t&&"string"==typeof t.message?o=t.message:n===r&&(o="Request aborted")),this.message=o,this.type=n,this.statusCode=e.statusCode||null,this.request=e.request,this.body=t},o={};function i(e){var t=e.total,r=e.loaded;return{total:t,transferred:r,percent:100*r/t}}var a="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};function s(e){var t={exports:{}};return e(t,t.exports),t.exports}var u=s(function(e,t){!function(r){var n=t,o=e&&e.exports==n&&e,i="object"==typeof a&&a;i.global!==i&&i.window!==i||(r=i);var s=function(e){this.message=e};(s.prototype=new Error).name="InvalidCharacterError";var u=function(e){throw new s(e)},c="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/",l=/[\t\n\f\r ]/g,f={encode:function(e){e=String(e),/[^\0-\xFF]/.test(e)&&u("The string to be encoded contains characters outside of the Latin1 range.");for(var t,r,n,o,i=e.length%3,a="",s=-1,l=e.length-i;++s<l;)t=e.charCodeAt(s)<<16,r=e.charCodeAt(++s)<<8,n=e.charCodeAt(++s),a+=c.charAt((o=t+r+n)>>18&63)+c.charAt(o>>12&63)+c.charAt(o>>6&63)+c.charAt(63&o);return 2==i?(t=e.charCodeAt(s)<<8,r=e.charCodeAt(++s),a+=c.charAt((o=t+r)>>10)+c.charAt(o>>4&63)+c.charAt(o<<2&63)+"="):1==i&&(o=e.charCodeAt(s),a+=c.charAt(o>>2)+c.charAt(o<<4&63)+"=="),a},decode:function(e){var t=(e=String(e).replace(l,"")).length;t%4==0&&(t=(e=e.replace(/==?$/,"")).length),(t%4==1||/[^+a-zA-Z0-9/]/.test(e))&&u("Invalid character: the string to be decoded is not correctly encoded.");for(var r,n,o=0,i="",a=-1;++a<t;)n=c.indexOf(e.charAt(a)),r=o%4?64*r+n:n,o++%4&&(i+=String.fromCharCode(255&r>>(-2*o&6)));return i},version:"0.1.0"};if(n&&!n.nodeType)if(o)o.exports=f;else for(var p in f)f.hasOwnProperty(p)&&(n[p]=f[p]);else r.base64=f}(a)}),c={};function l(e,t){return Object.prototype.hasOwnProperty.call(e,t)}var f=function(e){if(c[e])return c[e];var t=e.split("."),r=t[0],n=t[1];if(!n)throw new Error("Invalid token");var o=function(e){try{return JSON.parse(u.decode(e))}catch(e){throw new Error("Invalid token")}}(n),i={usage:r,user:o.u};return l(o,"a")&&(i.authorization=o.a),l(o,"exp")&&(i.expires=1e3*o.exp),l(o,"iat")&&(i.created=1e3*o.iat),l(o,"scopes")&&(i.scopes=o.scopes),l(o,"client")&&(i.client=o.client),l(o,"ll")&&(i.lastLogin=o.ll),l(o,"iu")&&(i.impersonator=o.iu),c[e]=i,i},p=function(){for(var e={},t=0;t<arguments.length;t++){var r=arguments[t];for(var n in r)d.call(r,n)&&(e[n]=r[n])}return e},d=Object.prototype.hasOwnProperty,h=s(function(e){var t=Object.prototype.hasOwnProperty,r="~";function n(){}function o(e,t,r){this.fn=e,this.context=t,this.once=r||!1}function i(e,t,n,i,a){if("function"!=typeof n)throw new TypeError("The listener must be a function");var s=new o(n,i||e,a),u=r?r+t:t;return e._events[u]?e._events[u].fn?e._events[u]=[e._events[u],s]:e._events[u].push(s):(e._events[u]=s,e._eventsCount++),e}function a(e,t){0==--e._eventsCount?e._events=new n:delete e._events[t]}function s(){this._events=new n,this._eventsCount=0}Object.create&&(n.prototype=Object.create(null),(new n).__proto__||(r=!1)),s.prototype.eventNames=function(){var e,n,o=[];if(0===this._eventsCount)return o;for(n in e=this._events)t.call(e,n)&&o.push(r?n.slice(1):n);return Object.getOwnPropertySymbols?o.concat(Object.getOwnPropertySymbols(e)):o},s.prototype.listeners=function(e){var t=this._events[r?r+e:e];if(!t)return[];if(t.fn)return[t.fn];for(var n=0,o=t.length,i=new Array(o);n<o;n++)i[n]=t[n].fn;return i},s.prototype.listenerCount=function(e){var t=this._events[r?r+e:e];return t?t.fn?1:t.length:0},s.prototype.emit=function(e,t,n,o,i,a){var s=r?r+e:e;if(!this._events[s])return!1;var u,c,l=this._events[s],f=arguments.length;if(l.fn){switch(l.once&&this.removeListener(e,l.fn,void 0,!0),f){case 1:return l.fn.call(l.context),!0;case 2:return l.fn.call(l.context,t),!0;case 3:return l.fn.call(l.context,t,n),!0;case 4:return l.fn.call(l.context,t,n,o),!0;case 5:return l.fn.call(l.context,t,n,o,i),!0;case 6:return l.fn.call(l.context,t,n,o,i,a),!0}for(c=1,u=new Array(f-1);c<f;c++)u[c-1]=arguments[c];l.fn.apply(l.context,u)}else{var p,d=l.length;for(c=0;c<d;c++)switch(l[c].once&&this.removeListener(e,l[c].fn,void 0,!0),f){case 1:l[c].fn.call(l[c].context);break;case 2:l[c].fn.call(l[c].context,t);break;case 3:l[c].fn.call(l[c].context,t,n);break;case 4:l[c].fn.call(l[c].context,t,n,o);break;default:if(!u)for(p=1,u=new Array(f-1);p<f;p++)u[p-1]=arguments[p];l[c].fn.apply(l[c].context,u)}}return!0},s.prototype.on=function(e,t,r){return i(this,e,t,r,!1)},s.prototype.once=function(e,t,r){return i(this,e,t,r,!0)},s.prototype.removeListener=function(e,t,n,o){var i=r?r+e:e;if(!this._events[i])return this;if(!t)return a(this,i),this;var s=this._events[i];if(s.fn)s.fn!==t||o&&!s.once||n&&s.context!==n||a(this,i);else{for(var u=0,c=[],l=s.length;u<l;u++)(s[u].fn!==t||o&&!s[u].once||n&&s[u].context!==n)&&c.push(s[u]);c.length?this._events[i]=1===c.length?c[0]:c:a(this,i)}return this},s.prototype.removeAllListeners=function(e){var t;return e?this._events[t=r?r+e:e]&&a(this,t):(this._events=new n,this._eventsCount=0),this},s.prototype.off=s.prototype.removeListener,s.prototype.addListener=s.prototype.on,s.prefixed=r,s.EventEmitter=s,e.exports=s});function y(e){return Array.isArray(e)?e.map(encodeURIComponent).join(","):encodeURIComponent(String(e))}function v(e,t,r){if(!1===r||null===r)return e;var n=/\?/.test(e)?"&":"?",o=encodeURIComponent(t);return void 0!==r&&""!==r&&!0!==r&&(o+="="+y(r)),""+e+n+o}var g={appendQueryObject:function(e,t){if(!t)return e;var r=e;return Object.keys(t).forEach(function(e){var n=t[e];void 0!==n&&(Array.isArray(n)&&(n=n.filter(function(e){return null!=e}).join(",")),r=v(r,e,n))}),r},appendQueryParam:v,prependOrigin:function(e,t){if(!t)return e;if("http"===e.slice(0,4))return e;var r="/"===e[0]?"":"/";return""+t.replace(/\/$/,"")+r+e},interpolateRouteParams:function(e,t){return t?e.replace(/\/:([a-zA-Z0-9]+)/g,function(e,r){var n=t[r];if(void 0===n)throw new Error("Unspecified route parameter "+r);return"/"+y(n)}):e}},b=1;function m(e,t){if(!e)throw new Error("MapiRequest requires a client");if(!t||!t.path||!t.method)throw new Error("MapiRequest requires an options object with path and method properties");var r={};t.body&&(r["content-type"]="application/json");var n=p(r,t.headers),o=Object.keys(n).reduce(function(e,t){return e[t.toLowerCase()]=n[t],e},{});this.id=b++,this._options=t,this.emitter=new h,this.client=e,this.response=null,this.error=null,this.sent=!1,this.aborted=!1,this.path=t.path,this.method=t.method,this.origin=t.origin||e.origin,this.query=t.query||{},this.params=t.params||{},this.body=t.body||null,this.file=t.file||null,this.encoding=t.encoding||"utf8",this.sendFileAs=t.sendFileAs||null,this.headers=o}m.prototype.url=function(e){var t=g.prependOrigin(this.path,this.origin);t=g.appendQueryObject(t,this.query);var r=this.params,n=null==e?this.client.accessToken:e;if(n){t=g.appendQueryParam(t,"access_token",n);var o=f(n).user;r=p({ownerId:o},r)}return g.interpolateRouteParams(t,r)},m.prototype.send=function(){var e=this;if(e.sent)throw new Error("This request has already been sent. Check the response and error properties. Create a new request with clone().");return e.sent=!0,e.client.sendRequest(e).then(function(t){return e.response=t,e.emitter.emit("response",t),t},function(t){throw e.error=t,e.emitter.emit("error",t),t})},m.prototype.abort=function(){this._nextPageRequest&&(this._nextPageRequest.abort(),delete this._nextPageRequest),this.response||this.error||this.aborted||(this.aborted=!0,this.client.abortRequest(this))},m.prototype.eachPage=function(e){var t=this;function r(r){e(null,r,function(){delete t._nextPageRequest;var e=r.nextPage();e&&(t._nextPageRequest=e,o(e))})}function n(t){e(t,null,function(){})}function o(e){e.send().then(r,n)}o(this)},m.prototype.clone=function(){return this._extend()},m.prototype._extend=function(e){var t=p(this._options,e);return new m(this.client,t)};var w=m;function k(e){if(!e||!e.accessToken)throw new Error("Cannot create a client without an access token");f(e.accessToken),this.accessToken=e.accessToken,this.origin=e.origin||"https://api.mapbox.com"}k.prototype.createRequest=function(e){return new w(this,e)};var O=k;function x(e){O.call(this,e)}(x.prototype=Object.create(O.prototype)).constructor=x,x.prototype.sendRequest=function(e){return Promise.resolve().then(function(){var a=function(e,t){var r=e.url(t),n=new window.XMLHttpRequest;return n.open(e.method,r),Object.keys(e.headers).forEach(function(t){n.setRequestHeader(t,e.headers[t])}),n}(e,e.client.accessToken);return function(e,a){return new Promise(function(t,s){a.onprogress=function(t){e.emitter.emit("downloadProgress",i(t))};var u=e.file;u&&(a.upload.onprogress=function(t){e.emitter.emit("uploadProgress",i(t))}),a.onerror=function(e){s(e)},a.onabort=function(){var t=new n({request:e,type:r});s(t)},a.onload=function(){if(delete o[e.id],a.status<200||a.status>=400){var r=new n({request:e,body:a.response,statusCode:a.status});s(r)}else t(a)};var c=e.body;"string"==typeof c?a.send(c):c?a.send(JSON.stringify(c)):u?a.send(u):a.send(),o[e.id]=a}).then(function(r){return function(e,r){return new t(e,{body:r.response,headers:(n=r.getAllResponseHeaders(),o={},n?(n.trim().split(/[\r|\n]+/).forEach(function(e){var t=function(e){var t=e.indexOf(":");return{name:e.substring(0,t).trim().toLowerCase(),value:e.substring(t+1).trim()}}(e);o[t.name]=t.value}),o):o),statusCode:r.status});var n,o}(e,r)})}(e,a)})},x.prototype.abortRequest=function(e){var t=o[e.id];t&&(t.abort(),delete o[e.id])};var q=function(e){return new x(e)},_=q,j=Object.prototype.toString,C="value",A="\n  ",S={};function E(e){var t=Array.isArray(e);return function(r){var n=R(S.plainArray,r);if(n)return n;if(t&&r.length!==e.length)return"an array with "+e.length+" items";for(var o=0;o<r.length;o++)if(n=R(t?e[o]:e,r[o]))return[o].concat(n)}}function R(e,t){if(null!=t||e.hasOwnProperty("__required")){var r=e(t);return r?Array.isArray(r)?r:[r]:void 0}}function P(e,t){var r=e.length,n=e[r-1],o=e.slice(0,r-1);return 0===o.length&&(o=[C]),t=p(t,{path:o}),"function"==typeof n?n(t):N(t,function(e){return"must be "+(/^an? /.test(t=e)?t:/^[aeiou]/i.test(t)?"an "+t:/^[a-z]/i.test(t)?"a "+t:t)+".";var t}(n))}function I(e){return e.length<2?e[0]:2===e.length?e.join(" or "):e.slice(0,-1).join(", ")+", or "+e.slice(-1)}function N(e,t){return(T(e.path)?"Item at position ":"")+e.path.join(".")+" "+t}function T(e){return"number"==typeof e[e.length-1]||"number"==typeof e[0]}S.assert=function(e,t){return t=t||{},function(r){var n=R(e,r);if(n){var o=P(n,t);throw t.apiName&&(o=t.apiName+": "+o),new Error(o)}}},S.shape=function(e){var t,r=(t=e,Object.keys(t||{}).map(function(e){return{key:e,value:t[e]}}));return function(e){var t,n=R(S.plainObject,e);if(n)return n;for(var o=[],i=0;i<r.length;i++)(n=R(r[i].value,e[t=r[i].key]))&&o.push([t].concat(n));return o.length<2?o[0]:function(e){o=o.map(function(t){return"- "+t[0]+": "+P(t,e).split("\n").join(A)});var t=e.path.join(".");return"The following properties"+(t===C?"":" of "+t)+" have invalid values:"+A+o.join(A)}}},S.strictShape=function(e){var t=S.shape(e);return function(r){var n=t(r);if(n)return n;var o=Object.keys(r).reduce(function(t,r){return void 0===e[r]&&t.push(r),t},[]);return 0!==o.length?function(){return"The following keys are invalid: "+o.join(", ")}:void 0}},S.arrayOf=function(e){return E(e)},S.tuple=function(){var e=Array.isArray(arguments[0])?arguments[0]:Array.prototype.slice.call(arguments);return E(e)},S.required=function(e){function t(t){return null==t?function(e){return N(e,T(e.path)?"cannot be undefined/null.":"is required.")}:e.apply(this,arguments)}return t.__required=!0,t},S.oneOfType=function(){var e=Array.isArray(arguments[0])?arguments[0]:Array.prototype.slice.call(arguments);return function(t){var r=e.map(function(e){return R(e,t)}).filter(Boolean);if(r.length===e.length)return r.every(function(e){return 1===e.length&&"string"==typeof e[0]})?I(r.map(function(e){return e[0]})):r.reduce(function(e,t){return t.length>e.length?t:e})}},S.equal=function(e){return function(t){if(t!==e)return JSON.stringify(e)}},S.oneOf=function(){var e=Array.isArray(arguments[0])?arguments[0]:Array.prototype.slice.call(arguments),t=e.map(function(e){return S.equal(e)});return S.oneOfType.apply(this,t)},S.range=function(e){var t=e[0],r=e[1];return function(e){if(R(S.number,e)||e<t||e>r)return"number between "+t+" & "+r+" (inclusive)"}},S.any=function(){},S.boolean=function(e){if("boolean"!=typeof e)return"boolean"},S.number=function(e){if("number"!=typeof e)return"number"},S.plainArray=function(e){if(!Array.isArray(e))return"array"},S.plainObject=function(e){if("[object Object]"!==j.call(t=e)||null!==(r=Object.getPrototypeOf(t))&&r!==Object.getPrototypeOf({}))return"object";var t,r},S.string=function(e){if("string"!=typeof e)return"string"},S.func=function(e){if("function"!=typeof e)return"function"},S.validate=R,S.processMessage=P;var L=S,z=p(L,{file:function(e){if("undefined"!=typeof window){if(e instanceof a.Blob||e instanceof a.ArrayBuffer)return;return"Blob or ArrayBuffer"}if("string"!=typeof e&&void 0===e.pipe)return"Filename or Readable stream"},date:function(e){var t="date";if("boolean"==typeof e)return t;try{var r=new Date(e);if(r.getTime&&isNaN(r.getTime()))return t}catch(e){return t}},coordinates:function(e){return L.tuple(L.number,L.number)(e)},assertShape:function(e,t){return L.assert(L.strictShape(e),t)}}),J=function(e){return function(t){var r;r=O.prototype.isPrototypeOf(t)?t:q(t);var n=Object.create(e);return n.client=r,n}},M=function(e,t){var r=function(e,r){return-1!==t.indexOf(e)&&void 0!==r};return"function"==typeof t&&(r=t),Object.keys(e).filter(function(t){return r(t,e[t])}).reduce(function(t,r){return t[r]=e[r],t},{})},U=J({getDirections:function(e){z.assertShape({profile:z.oneOf("driving-traffic","driving","walking","cycling"),waypoints:z.required(z.arrayOf(z.shape({coordinates:z.required(z.coordinates),approach:z.oneOf("unrestricted","curb"),bearing:z.arrayOf(z.range([0,360])),radius:z.oneOfType(z.number,z.equal("unlimited")),waypointName:z.string}))),alternatives:z.boolean,annotations:z.arrayOf(z.oneOf("duration","distance","speed","congestion")),bannerInstructions:z.boolean,continueStraight:z.boolean,exclude:z.string,geometries:z.string,language:z.string,overview:z.string,roundaboutExits:z.boolean,steps:z.boolean,voiceInstructions:z.boolean,voiceUnits:z.string})(e),e.profile=e.profile||"driving";var t={coordinates:[],approach:[],bearing:[],radius:[],waypointName:[]},r=e.waypoints.length;if(r<2||r>25)throw new Error("waypoints must include between 2 and 25 DirectionsWaypoints");e.waypoints.forEach(function(e){t.coordinates.push(e.coordinates[0]+","+e.coordinates[1]),["bearing"].forEach(function(t){e.hasOwnProperty(t)&&null!=e[t]&&(e[t]=e[t].join(","))}),["approach","bearing","radius","waypointName"].forEach(function(r){e.hasOwnProperty(r)&&null!=e[r]?t[r].push(e[r]):t[r].push("")})}),["approach","bearing","radius","waypointName"].forEach(function(e){t[e].every(function(e){return""===e})?delete t[e]:t[e]=t[e].join(";")});var n,o=function(e){return function(e,t){return Object.keys(e).reduce(function(t,r){return t[r]="boolean"==typeof(n=e[r])?JSON.stringify(n):n,t;var n},{})}(e)}({alternatives:e.alternatives,annotations:e.annotations,banner_instructions:e.bannerInstructions,continue_straight:e.continueStraight,exclude:e.exclude,geometries:e.geometries,language:e.language,overview:e.overview,roundabout_exits:e.roundaboutExits,steps:e.steps,voice_instructions:e.voiceInstructions,voice_units:e.voiceUnits,approaches:t.approach,bearings:t.bearing,radiuses:t.radius,waypoint_names:t.waypointName});return this.client.createRequest({method:"GET",path:"/directions/v5/mapbox/:profile/:coordinates",params:{profile:e.profile,coordinates:t.coordinates.join(";")},query:(n=o,M(n,function(e,t){return null!=t}))})}}),B=s(function(e){var t={};function r(e){return Math.floor(Math.abs(e)+.5)*(e>=0?1:-1)}function n(e,t,n){var o=(e=r(e*n))-(t=r(t*n));o<<=1,e-t<0&&(o=~o);for(var i="";o>=32;)i+=String.fromCharCode(63+(32|31&o)),o>>=5;return i+String.fromCharCode(o+63)}function o(e){for(var t=[],r=0;r<e.length;r++){var n=e[r].slice();t.push([n[1],n[0]])}return t}t.decode=function(e,t){for(var r,n=0,o=0,i=0,a=[],s=0,u=0,c=null,l=Math.pow(10,Number.isInteger(t)?t:5);n<e.length;){c=null,s=0,u=0;do{u|=(31&(c=e.charCodeAt(n++)-63))<<s,s+=5}while(c>=32);r=1&u?~(u>>1):u>>1,s=u=0;do{u|=(31&(c=e.charCodeAt(n++)-63))<<s,s+=5}while(c>=32);a.push([(o+=r)/l,(i+=1&u?~(u>>1):u>>1)/l])}return a},t.encode=function(e,t){if(!e.length)return"";for(var r=Math.pow(10,Number.isInteger(t)?t:5),o=n(e[0][0],0,r)+n(e[0][1],0,r),i=1;i<e.length;i++){var a=e[i],s=e[i-1];o+=n(a[0],s[0],r),o+=n(a[1],s[1],r)}return o},t.fromGeoJSON=function(e,r){if(e&&"Feature"===e.type&&(e=e.geometry),!e||"LineString"!==e.type)throw new Error("Input must be a GeoJSON LineString");return t.encode(o(e.coordinates),r)},t.toGeoJSON=function(e,r){return{type:"LineString",coordinates:o(t.decode(e,r))}},e.exports&&(e.exports=t)}),F={};function H(e){return e.replace(/^#/,"")}F.getStaticImage=function(e){z.assertShape({ownerId:z.required(z.string),styleId:z.required(z.string),width:z.required(z.range([1,1280])),height:z.required(z.range([1,1280])),position:z.required(z.oneOfType(z.oneOf("auto"),z.strictShape({coordinates:z.required(z.coordinates),zoom:z.required(z.range([0,20])),bearing:z.range([0,360]),pitch:z.range([0,60])}),z.strictShape({bbox:z.required(z.arrayOf(z.number))}))),padding:z.string,overlays:z.arrayOf(z.plainObject),highRes:z.boolean,before_layer:z.string,addlayer:z.plainObject,setfilter:z.plainArray,layer_id:z.string,attribution:z.boolean,logo:z.boolean})(e);var t,r=(e.overlays||[]).map(function(e){return e.marker?function(e){return e.url?function(e){return z.assertShape({coordinates:z.required(z.coordinates),url:z.required(z.string)})(e),"url-"+encodeURIComponent(e.url)+"("+e.coordinates.join(",")+")"}(e):function(e){z.assertShape({coordinates:z.required(z.coordinates),size:z.oneOf("large","small"),label:z.string,color:z.string})(e);var t="large"===e.size?"pin-l":"pin-s";return e.label&&(t+="-"+String(e.label).toLowerCase()),e.color&&(t+="+"+H(e.color)),t+"("+e.coordinates.join(",")+")"}(e)}(e.marker):e.path?function(e){if(z.assertShape({coordinates:z.required(z.arrayOf(z.coordinates)),strokeWidth:z.number,strokeColor:z.string,strokeOpacity:z.number,fillColor:z.string,fillOpacity:z.number})(e),void 0!==e.strokeOpacity&&void 0===e.strokeColor)throw new Error("strokeOpacity requires strokeColor");if(void 0!==e.fillColor&&void 0===e.strokeColor)throw new Error("fillColor requires strokeColor");if(void 0!==e.fillOpacity&&void 0===e.fillColor)throw new Error("fillOpacity requires fillColor");var t="path";e.strokeWidth&&(t+="-"+e.strokeWidth),e.strokeColor&&(t+="+"+H(e.strokeColor)),e.strokeOpacity&&(t+="-"+e.strokeOpacity),e.fillColor&&(t+="+"+H(e.fillColor)),e.fillOpacity&&(t+="-"+e.fillOpacity);var r=e.coordinates.map(function(e){return[e[1],e[0]]}),n=B.encode(r);return t+"("+encodeURIComponent(n)+")"}(e.path):(t=e.geoJson,z.assert(z.required(z.plainObject))(t),"geojson("+encodeURIComponent(JSON.stringify(t))+")");var t}).join(","),n="auto"===(t=e.position)?"auto":t.bbox?JSON.stringify(t.bbox):t.coordinates.concat([t.zoom,t.pitch&&!t.bearing?0:t.bearing,0===t.pitch?void 0:t.pitch]).filter(function(e){return 0===e||e}).join(","),o=e.width+"x"+e.height;e.highRes&&(o+="@2x");var i=[r,n,o].filter(Boolean).join("/"),a={};if(void 0!==e.attribution&&(a.attribution=String(e.attribution)),void 0!==e.logo&&(a.logo=String(e.logo)),void 0!==e.before_layer&&(a.before_layer=e.before_layer),void 0!==e.addlayer&&(a.addlayer=JSON.stringify(e.addlayer)),void 0!==e.setfilter&&(a.setfilter=JSON.stringify(e.setfilter)),void 0!==e.layer_id&&(a.layer_id=e.layer_id),void 0!==e.padding&&(a.padding=e.padding),void 0!==e.setfilter&&void 0===e.layer_id)throw new Error("Must include layer_id in setfilter request");if((void 0!==e.setfilter||void 0!==e.addlayer)&&"auto"===e.position&&void 0===e.overlays)throw new Error("Auto extent cannot be used with style parameters and no overlay");if(void 0!==e.addlayer&&void 0!==e.setfilter)throw new Error("addlayer and setfilter cannot be used in the same request");if(void 0!==e.padding&&"auto"!==e.position&&void 0===e.position.bbox)throw new Error("Padding can only be used with auto or bbox as the position.");if(void 0!==e.position.bbox&&4!==e.position.bbox.length)throw new Error("bbox must be four coordinates");return this.client.createRequest({method:"GET",path:"/styles/v1/:ownerId/:styleId/static/"+i,params:M(e,["ownerId","styleId"]),query:a,encoding:"binary"})};var G=J(F),W={en:"ckk539qa10fhi17obyhy2y1zq",vi:"ckkd9taew031917mobvou6km3",ar:"ckkd9ta79031k17p69kdw11j4",ko:"ckkd9taft031817r62o6yt3rh",fr:"ckkd9ta9c02zz18ox18h8npte",it:"ckkd9ta9y030817mf6qbwxyyu",ja:"ckkd9tadr031m17ogcb7qqkz9",es:"ckkd9ta6y032v17qhmhfnidf7",de:"ckkd9ta8q02uw18shlf7ndc18",pt:"ckkd9taal00fb17te6yytq95e","zh-Hant":"ckkd9tad9030g17o08fjxbw3k","zh-Hans":"ckkd9tacd033c17p996c3m2ls",ru:"ckkd9taav031f17oas2n9w1hx"};return function(e,t){var r=_({accessToken:e.accessToken}),n=G(r),o=U(r),i=e.itinerary;o.getDirections({profile:"driving",continueStraight:!1,waypoints:e.itinerary.waypoints.map(function(e){return{coordinates:e.coordinates}}),geometries:"polyline",overview:"simplified"}).send().then(function(r){if("Ok"===r.body.code&&r.body.routes.length){var o={path:{coordinates:B.decode(r.body.routes[0].geometry,5).map(function(e){return[e[1],e[0]]}),strokeWidth:2,strokeColor:e.color}},a=i.waypoints.map(function(t,r){return{marker:{coordinates:t.coordinates,label:""+(r+1),color:e.color}}}),s={top:e.top||0,right:e.right||0,bottom:e.bottom||0,left:e.left||0},u={ownerId:"visitqatar",styleId:e.language&&e.language in W?W[e.language]:W.en,width:e.width,height:e.height,position:"auto",padding:s.top+","+s.right+","+s.bottom+","+s.left,highRes:e.highRes,overlays:[o].concat(a)};console.log(u);var c=n.getStaticImage(u).url();t(null,c)}else t(!0,null)})}});
//# sourceMappingURL=mapbox-static-map.umd.js.map
