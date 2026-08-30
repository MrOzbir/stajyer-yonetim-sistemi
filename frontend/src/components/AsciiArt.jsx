import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';

export default function AsciiArt() {
    const mountRef = useRef(null);

    useEffect(() => {
        let camera, scene, renderer, effect, controls;
        let group;

        const start = Date.now();
        let animationFrameId;

        init();

        function init() {
            camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 1000);
            camera.position.y = 0;
            camera.position.z = 250; // Biraz daha yakınlaştırdık

            scene = new THREE.Scene();
            scene.background = new THREE.Color(0, 0, 0);

            const pointLight1 = new THREE.PointLight(0xffffff, 3, 0, 0);
            pointLight1.position.set(500, 500, 500);
            scene.add(pointLight1);

            const pointLight2 = new THREE.PointLight(0xffffff, 1, 0, 0);
            pointLight2.position.set(-500, -500, -500);
            scene.add(pointLight2);

            group = new THREE.Group();
            scene.add(group);

            // 3D Font Yükleyici
            const loader = new FontLoader();
            loader.load('/fonts/helvetiker_regular.typeface.json', function (font) {
                const material = new THREE.MeshPhongMaterial({ flatShading: true });

                const texts = ["S Y S"];
                let yOffset = -20;

                texts.forEach((text, index) => {
                    const geometry = new TextGeometry(text, {
                        font: font,
                        size: 65, // Boyut arttırıldı
                        depth: 20,
                        curveSegments: 2,
                        bevelEnabled: true,
                        bevelThickness: 3,
                        bevelSize: 2,
                        bevelOffset: 0,
                        bevelSegments: 2
                    });

                    // Metni tam ortaya (merkeze) hizalamak için genişliğini ölç
                    geometry.computeBoundingBox();
                    const xOffset = -0.5 * (geometry.boundingBox.max.x - geometry.boundingBox.min.x);

                    const mesh = new THREE.Mesh(geometry, material);
                    mesh.position.set(xOffset, yOffset - (index * 45), 0);
                    group.add(mesh);
                });

                // Ekran boyutuna göre 3D objeyi konumlandır (Mobil vs Masaüstü)
                if (window.innerWidth < 1024) {
                    group.position.y = 120; // Mobilde formun üstüne taşı
                } else {
                    group.position.x = -60; // Biraz sağa kaydırıldı
                    group.position.y = 40;   // Hafif yukarı
                }

                // Font yüklenince animasyonu başlat
                animate();
            });

            renderer = new THREE.WebGLRenderer();
            renderer.setSize(window.innerWidth, window.innerHeight);

            effect = new AsciiEffect(renderer, ' .:-+*=%@#', { invert: true });
            effect.setSize(window.innerWidth, window.innerHeight);

            effect.domElement.style.color = '#e32938'; // Marka kırmızı rengi
            effect.domElement.style.backgroundColor = 'transparent';
            effect.domElement.style.cursor = 'grab';
            effect.domElement.style.fontFamily = 'monospace';

            if (mountRef.current) {
                mountRef.current.innerHTML = '';
                mountRef.current.appendChild(effect.domElement);
            }

            controls = new OrbitControls(camera, effect.domElement);
            controls.enableDamping = true;
            controls.dampingFactor = 0.05;
            controls.enableZoom = false; // Scroll'u bozmaması için

            // Pencere yeniden boyutlandırıldığında duyarlı yap
            window.addEventListener('resize', onWindowResize);
        }

        function onWindowResize() {
            if (camera && effect && renderer) {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                // Boyutları güncelle
                renderer.setSize(window.innerWidth, window.innerHeight);
                effect.setSize(window.innerWidth, window.innerHeight);

                // Ekran yeniden boyutlandığında objenin pozisyonunu güncelle
                if (group) {
                    if (window.innerWidth < 1024) {
                        group.position.x = 0;
                        group.position.y = 120;
                    } else {
                        group.position.x = -60; // Biraz sağa kaydırıldı
                        group.position.y = 40;   // Hafif yukarı
                    }
                }
            }
        }

        function animate() {
            animationFrameId = requestAnimationFrame(animate);

            const timer = Date.now() - start;
            if (group) {
                group.rotation.x = Math.sin(timer * 0.001) * 0.15; // hafif aşağı-yukarı salınım
                group.rotation.y = timer * 0.0005; // kendi etrafında dönme hızı
            }

            if (controls) controls.update();
            if (effect) effect.render(scene, camera);
        }

        return () => {
            window.removeEventListener('resize', onWindowResize);
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (mountRef.current && effect) {
                mountRef.current.innerHTML = '';
            }
            if (renderer) renderer.dispose();
            if (controls) controls.dispose();
        };
    }, []);

    return (
        <div className="absolute inset-0 w-full h-full flex justify-center items-center pointer-events-auto">
            <div
                ref={mountRef}
                className="w-full h-full overflow-hidden bg-night"
            ></div>
        </div>
    );
}
