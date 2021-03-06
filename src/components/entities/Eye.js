import React, { Component, PropTypes } from 'react';
import THREE from 'three';
import { Mesh } from '../';

export default class Eye extends Component {

    render() {

        const {
            position, quaternion, rotation, scale, materialId, assets
        } = this.props;

        return <Mesh
            ref="mesh"
            position={ position }
            quaternion={ rotation }
            quaternion={ quaternion }
            scale={ scale }
            assets={ assets }
            meshName="eye"
            materialId={ materialId }
        />;

    }

}
