import './ui/ui.css';
import { Game } from './Game';

const mount = document.getElementById('game') ?? document.body;
new Game(mount);
