const API_URL = 'https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address';
const API_TOKEN = '89147d67ecec30829c71feb6b8ebc352a7dd4e7a';

const searchWrapper = document.querySelector('.search__input-wrapper');
const searchInput = searchWrapper.querySelector('#search');
const searchHistoryBlock = document.querySelector('.history__list');
const searchErrorBlock = document.querySelector('.search__error');
const suggestionBlock = document.querySelector('.search__suggest');
const resultBlock = document.querySelector('.result');
const resultTable = resultBlock.querySelector('.result__table');
const resultMapWrapper = resultBlock.querySelector('.result__map');
const settingsBlock = document.querySelector('.settings');
const searchQueryExamples = document.querySelectorAll('.sidebar__block-item_example');

const getLocalStorageSupport = () => {
    try {
        return !!window.localStorage;
    } catch (error) {
        console.debug(error);
        return false;
    }
}
const localStorageSupport = getLocalStorageSupport();

const clearSuggestions = () => suggestionBlock.innerHTML = '';
const hideResult = () => resultBlock.classList.remove('result_active');

const addLoadingEffect = (disableInput = false) => {
    searchWrapper.classList.add('search__input-wrapper_loading');
    if (disableInput) searchInput.disabled = true;
}
const removeLoadingEffect = () => {
    searchWrapper.classList.remove('search__input-wrapper_loading');
    searchInput.disabled = false;
}

const renderError = (error) => searchErrorBlock.textContent = error;
const clearError = () => searchErrorBlock.textContent = '';

const getSearchHistory = () => {
    const searchHistory = window.localStorage.getItem('search-history');
    if (!searchHistory) return [];

    try {
        return JSON.parse(searchHistory);
    } catch (error) {
        // Сносим историю, если данные битые и не получается спарсить
        window.localStorage.removeItem('search-history');
        console.debug('histoty cleared', error);
        return [];
    }
}

const updateSearchHistory = (query) => {
    if (!query) return;
    
    const searchHistory = getSearchHistory();
    let array = [query];

    if (searchHistory.length > 0) {
        if (searchHistory.includes(query)) return;
        searchHistory.unshift(query);
        array = searchHistory;
    }

    result = JSON.stringify(array);

    try {
        window.localStorage.setItem('search-history', result);
    } catch (error) {
        if (error.name === 'QuotaExceededError') {
            // Освобождаем место, если localStorage переполнился
            array = array.slice(0, Math.floor(array.length / 2));
            result = JSON.stringify(array);
    
            window.localStorage.setItem('search-history', result);
            console.debug('reduce history length', error);
        } else {
            // Сносим если дело не в этом
            window.localStorage.removeItem('search-history');
            console.debug('histoty cleared', error);
        }
    }

    renderSearchHistory();
}

const renderSearchHistory = () => {
    if (!localStorageSupport) {
        searchHistoryBlock.innerHTML = '<span style="color: var(--c-main);">В вашем бразуере отключен localStorage :(</span>';
        return;
    }

    searchHistoryBlock.innerHTML = '';
    
    let searchHistory = getSearchHistory();
    searchHistory = searchHistory.slice(0, 5);

    searchHistory.forEach(item => {
        const element = document.createElement('div');
        element.textContent = item;
        element.classList.add('sidebar__block-item');
        element.addEventListener('click', () => renderResult(item));
        searchHistoryBlock.append(element);
    });
}
renderSearchHistory();

const debounce = (callee, timeout) => {
    return function perform(...args) {
        let previousCall = this.lastCall
        this.lastCall = Date.now()

        if (previousCall && this.lastCall - previousCall <= timeout) {
            clearTimeout(this.lastCallTimer)
        }

        this.lastCallTimer = setTimeout(() => callee(...args), timeout)
    }
}

const getSelectedLanguage = () => {
    const activeLanguaguge = settingsBlock.querySelector('input[name="language"]:checked');
    return activeLanguaguge?.value || 'en';    
}

const getCurrentSearchQuery = () => searchInput.value;

const request = {
    method: 'POST',
    mode: 'cors',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Token ${API_TOKEN}`,
    },
    count: 10,
    get body() {
        return JSON.stringify({
            query: getCurrentSearchQuery(),
            language: getSelectedLanguage(),
            count: this.count,
            locations: {
                country: '*',
            },
        });
    },
};

const getData = async (count = 10) => {
    request.count = count;

    let response = null;
    try {
        response = await fetch(API_URL, request);
    } catch (error) {
        renderError('Что-то пошло не так, попробуйте обновить страницу');
        console.debug(error);
        return;
    }
    
    if (response.ok) {
        return response.json();
    }

    renderError('Ошибка, проверьте подключение к Интернету и попробуйте снова');
}

const getSuggestions = async () => {
    const query = getCurrentSearchQuery();
    let result = [];

    if (localStorageSupport) {
        const searchHistory = getSearchHistory();
        const queryRegExp = new RegExp(`.*(${query}).*`, 'i');
    
        searchHistory.forEach(item => {
            if (queryRegExp.test(item)) result.push({
                history: true,
                value: item,
            });
        });
    
        result = result.slice(0, 5);
    }

    let data = null;
    try {
        data = await getData();
    }
    catch (error) {
        renderError('Что-то пошло не так, попробуйте обновить страницу');
        console.debug(error);
        return;
    }

    const suggestions = data.suggestions;
    
    if (!suggestions) {
        renderError('Ошибка, попробуйте изменить запрос или обновить страницу');
        return;
    }

    if (!suggestions.length) {
        renderError('Не удалось ничего найти, измените запрос и попробуйте снова');
        return;
    }

    for (const suggest in suggestions) {
        result.push({
            history: false,
            value: suggestions[suggest].value,
        });
    }

    result = result.reduce((acc, item) => {
        if (!acc.find(element => element.value === item.value)) acc.push(item);
        return acc;
    }, []);

    return result.slice(0, 10);
}

const getResult = async () => {
    let data = null;
    try {
        data = await getData(1);
    }
    catch (error) {
        renderError('Что-то пошло не так, попробуйте обновить страницу');
        console.debug(error);
        return;
    }

    if (!data.suggestions || !data.suggestions[0]) {
        renderError('Ошибка, попробуйте изменить запрос или обновить страницу');
        return;
    }

    return data.suggestions[0];
}

const renderSuggestions = async () => {
    clearSuggestions();
    hideResult();

    const queryLength = getCurrentSearchQuery().length;
    if (!queryLength) return;

    if (queryLength < 3) {
        renderError('Пожалуйста, введите не менее 3 символов в поисковой строке');
        return;
    }

    addLoadingEffect();

    const suggestions = await getSuggestions();

    if (!suggestions) {
        removeLoadingEffect();
        return;
    }

    suggestions.forEach(suggest => {
        const element = document.createElement('div');
        element.textContent = suggest.value;
        element.classList.add('search__suggest-item');
        if (suggest.history) element.classList.add('search__suggest-item_history');
        element.addEventListener('click', () => renderResult(suggest.value));
        suggestionBlock.append(element);
    });
    removeLoadingEffect();
}
const debouncedRenderSuggestions = debounce(renderSuggestions, 1000);

const renderResult = async (query) => {
    searchInput.value = query;

    clearSuggestions();
    addLoadingEffect(true);

    const result = await getResult();

    resultTable.innerHTML = '';

    const cords = (result.data.geo_lat && result.data.geo_lon) ? `${result.data.geo_lat}, ${result.data.geo_lon}` : null;

    // ФИАС-код (он же код ГАР) адреса для России.
    // Идентификатор OpenStreetMap для Беларуси, Казахстана и Узбекистана.
    // Для остальных стран — идентификатор объекта в базе GeoNames. 
    let fiasValue = result.data.fias_id;
    let fiasName = 'ФИАС';
    if (fiasValue) {
        if (/^\d+$/.test(fiasValue)) {
            fiasValue = `<a href="https://www.geonames.org/${fiasValue}/" target="_blank">${fiasValue}</a>`;
            fiasName = 'GeoNames';
        } else if (/^\w+:\d+$/.test(fiasValue)) {
            fiasValue = `<a href="https://www.openstreetmap.org/${fiasValue.replace(':', '/')}/" target="_blank">${fiasValue}</a>`;
            fiasName = 'OpenStreetMap';
        } else {
            fiasValue = `<a href="http://basicdata.ru/online/fias/${fiasValue}/" target="_blank">${fiasValue}</a>`;
        }
    }

    const options = [
        {
            name: 'Полный адрес',
            value: result.unrestricted_value,
        },
        {
            name: 'Координаты',
            value: cords ? `<a href="https://yandex.ru/maps/?text=${result.data.geo_lat}%2C${result.data.geo_lon}" target="_blank">${cords}</a>` : null,
        },
        {
            name: 'Индекс',
            value: result.data.postal_code,
        },
        {
            name: 'Страна',
            value: result.data.country,
        },
        {
            name: 'ISO код страны',
            value: result.data.country_iso_code,
        },
        {
            name: 'Федеральный округ',
            value: result.data.federal_district,
        },
        {
            name: 'Регион',
            value: result.data.region_with_type,
        },
        {
            name: 'ISO код региона',
            value: result.data.region_iso_code,
        },
        {
            name: 'Город',
            value: result.data.city,
        },
        {
            name: 'Улица',
            value: result.data.street,
        },
        {
            name: 'Земельный участок',
            value: result.data.stead,
        },
        {
            name: 'Дом',
            value: result.data.house,
        },
        {
            name: 'Квартира',
            value: result.data.flat,
        },
        {
            name: fiasName,
            value: fiasValue,
        },
        {
            name: 'КЛАДР',
            value: result.data.kladr_id,
        },
        {
            name: 'ОКАТО',
            value: result.data.okato,
        },
        {
            name: 'ОКТМО',
            value: result.data.oktmo,
        },
        {
            name: 'ИФНС',
            value: result.data.tax_office,
        },
    ];

    options.forEach(option => {
        if (!option.value) return;

        const nameCell = document.createElement('div');
        const valueCell = document.createElement('div');

        nameCell.textContent = option.name;
        valueCell.innerHTML = option.value;

        resultTable.append(nameCell);
        resultTable.append(valueCell);
    });

    if (cords) {
        window.resultMap.setCenter([result.data.geo_lat, result.data.geo_lon], 15, { checkZoomRange: true });
        resultMapWrapper.classList.add('result__map_active');
    } else {
        resultMapWrapper.classList.remove('result__map_active');
    }

    if (localStorageSupport) updateSearchHistory(result.value);

    resultBlock.classList.add('result_active');
    removeLoadingEffect();
}

const interact = () => {
    removeLoadingEffect();
    clearError();
    clearSuggestions();
    hideResult();
    debouncedRenderSuggestions();
}

searchInput.addEventListener('input', () => interact());
searchInput.addEventListener('keyup', (event) => {
    if (event.key === 'Enter') interact();
});

window.addEventListener('storage', (event) => {
    console.debug(event)
    if (event.key === 'search-history') {
        renderSearchHistory();
    }
});

searchQueryExamples.forEach(example => {
    example.addEventListener('click', () => renderResult(example.textContent));
});

ymaps.ready(() => {
    window.resultMap = new ymaps.Map('result-map', {
        center: ['55.608475', '-27.669462'],
        zoom: 2,
        controls: ['zoomControl'],
    }, {
        suppressMapOpenBlock: true,
    });
});
