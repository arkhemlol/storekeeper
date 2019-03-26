import { observable } from 'mobx';

class GeneralStore {
  @observable language = null;

  constructor() {
  }
}

export default GeneralStore;
