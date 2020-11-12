'use strict';

import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import largeNumber from 'large-number';
import bg from './images/bg.jpg';
import './search.less';

class Search extends React.Component {
    constructor() {
        super(...arguments);

        this.state = {
            Text: null
        };
    }

    loadComponent() {
        import('./text.js').then((Text) => {
            this.setState({
                Text: Text.default
            });
        });
    }

    render() {
        const { Text } = this.state;
        const addResult = largeNumber('999', '1');
        return <div className="search-text">
            {
                Text ? <Text /> : null
            }
            { addResult }  
            <img src={ bg } /> <br/>    
            <button onClick={ this.loadComponent.bind(this) }>点我呗～</button>
        </div>;
    }
}

ReactDOM.render(
    <Search />,
    document.getElementById('root')
);